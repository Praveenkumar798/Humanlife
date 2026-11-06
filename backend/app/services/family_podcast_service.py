"""
Human Legacy AI - Family Sharing & Audio Memoir Podcast Service

Powers the family public tribute portal, guest cognitive chat, and automated
documentary-style audio memoir podcast production.
"""

import secrets
import uuid
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.config import settings
from app.models.user import User
from app.models.memory import Memory
from app.models.family_share import FamilyShare
from app.schemas.family_podcast import (
    FamilyShareResponse,
    PublicLegacyProfileResponse,
    PublicLegacyTimelineItem,
    PublicChatResponse,
    AudioPodcastResponse,
)
from app.services.embedding_service import generate_embedding, get_gemini_client
from app.services.rag_service import (
    search_relevant_chunks,
    generate_grounded_answer,
    is_conversational_acknowledgement,
    FALLBACK_INSUFFICIENT_INFO,
)
from app.services.voice_fallback_service import synthesize_text_to_speech


# =============================================================================
# 1. Family Sharing Operations
# =============================================================================

async def get_or_create_family_share(
    db: AsyncSession,
    user_id: uuid.UUID,
    label: Optional[str] = "Family & Loved Ones",
    allow_chat: bool = True,
) -> FamilyShare:
    """Retrieve existing active share record or create a new secure share token."""
    stmt = select(FamilyShare).where(FamilyShare.user_id == user_id)
    result = await db.execute(stmt)
    share = result.scalars().first()

    if not share:
        # Generate URL-safe 24-character token
        token = secrets.token_urlsafe(18)
        share = FamilyShare(
            id=uuid.uuid4(),
            user_id=user_id,
            share_token=token,
            label=label or "Family & Loved Ones",
            is_active=True,
            allow_chat=allow_chat,
            views_count=0,
        )
        db.add(share)
        await db.commit()
        await db.refresh(share)

    return share


async def update_family_share(
    db: AsyncSession,
    user_id: uuid.UUID,
    share_token: str,
    label: Optional[str] = None,
    is_active: Optional[bool] = None,
    allow_chat: Optional[bool] = None,
) -> FamilyShare:
    """Update settings or toggle active state of a family share link."""
    stmt = select(FamilyShare).where(
        FamilyShare.user_id == user_id,
        FamilyShare.share_token == share_token,
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found.")

    if label is not None:
        share.label = label
    if is_active is not None:
        share.is_active = is_active
    if allow_chat is not None:
        share.allow_chat = allow_chat

    await db.commit()
    await db.refresh(share)
    return share


async def regenerate_family_share_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    old_token: str,
) -> FamilyShare:
    """Invalidate old token and issue a fresh share token."""
    stmt = select(FamilyShare).where(
        FamilyShare.user_id == user_id,
        FamilyShare.share_token == old_token,
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found.")

    share.share_token = secrets.token_urlsafe(18)
    share.is_active = True
    await db.commit()
    await db.refresh(share)
    return share


async def get_public_legacy_profile(
    db: AsyncSession,
    share_token: str,
) -> PublicLegacyProfileResponse:
    """
    Public guest lookup: Retrieve user's life timeline without authentication.
    Strictly read-only; increments view counter.
    """
    stmt = select(FamilyShare).where(
        FamilyShare.share_token == share_token,
        FamilyShare.is_active == True,
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This family share link is invalid or has been revoked by the author.",
        )

    # Increment view counter
    share.views_count += 1
    await db.commit()

    # Load Author
    stmt_user = select(User).where(User.id == share.user_id)
    user_res = await db.execute(stmt_user)
    author = user_res.scalar_one_or_none()

    # Load memories chronologically
    stmt_mem = (
        select(Memory)
        .where(Memory.user_id == share.user_id)
        .order_by(Memory.event_date.asc().nulls_last(), Memory.created_at.asc())
    )
    mem_res = await db.execute(stmt_mem)
    memories = mem_res.scalars().all()

    timeline_items = [
        PublicLegacyTimelineItem(
            id=m.id,
            title=m.title,
            content=m.content,
            category=m.category,
            event_date=m.event_date.strftime("%B %d, %Y") if m.event_date else None,
            importance=m.importance,
            source_type=m.source_type,
            tags=m.tags or [],
        )
        for m in memories
    ]

    author_name = author.full_name or author.username if author else "Family Legacy Author"
    author_username = author.username if author else "author"

    return PublicLegacyProfileResponse(
        author_name=author_name,
        author_username=author_username,
        label=share.label,
        allow_chat=share.allow_chat,
        total_memories=len(memories),
        memories=timeline_items,
    )


async def execute_public_family_chat(
    db: AsyncSession,
    share_token: str,
    question: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> PublicChatResponse:
    """
    Execute guest RAG chat for family members grounded strictly in author's memories.
    """
    stmt = select(FamilyShare).where(
        FamilyShare.share_token == share_token,
        FamilyShare.is_active == True,
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link is invalid or expired.",
        )

    if not share.allow_chat:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Interactive chat has been paused for this share link by the author.",
        )

    # Fetch author info
    stmt_user = select(User).where(User.id == share.user_id)
    author = (await db.execute(stmt_user)).scalar_one_or_none()
    author_name = author.full_name or author.username if author else "Author"

    clean_q = question.strip()
    if is_conversational_acknowledgement(clean_q):
        return PublicChatResponse(
            answer=f"Warm greetings to you! I am the cognitive memory replica of {author_name}. Ask me anything about my childhood, values, family memories, or life lessons.",
            author_name=author_name,
            citations=[],
        )

    # Generate question embedding and search memory chunks
    query_emb = await generate_embedding(clean_q)
    citations = await search_relevant_chunks(
        db=db,
        user_id=share.user_id,
        query_embedding=query_emb,
        top_k=5,
        similarity_threshold=0.48,
    )

    if not citations:
        return PublicChatResponse(
            answer=f"I couldn't find memories in {author_name}'s vault regarding that specific question. Feel free to ask about another milestone, decision, or life experience.",
            author_name=author_name,
            citations=[],
        )

    # Persona prompt for family members
    context_text = "\n\n".join([f"Memory [{c.memory_title}]: {c.chunk_text}" for c in citations])
    persona_prompt = f"""You are the authentic cognitive replica of {author_name}, speaking warmly to a visiting family member or loved one.
Answer their question truthfully based ONLY on the preserved memories below:

EVIDENCE FROM STORED MEMORIES:
{context_text}

FAMILY MEMBER QUESTION:
"{clean_q}"

INSTRUCTIONS:
1. Speak in a warm, loving, reflective first-person voice ('In my life...', 'I always felt...').
2. Ground your answer strictly in the evidence provided. Do not invent false facts.
3. Keep the tone intimate, wise, and comforting."""

    answer_text, _ = await generate_grounded_answer(
        question=clean_q,
        citations=citations,
        conversational_prompt=persona_prompt,
    )

    citation_titles = list(dict.fromkeys([c.memory_title for c in citations]))

    return PublicChatResponse(
        answer=answer_text,
        author_name=author_name,
        citations=citation_titles,
    )


# =============================================================================
# 2. Audio Memoir Podcast Generator
# =============================================================================

async def generate_audio_memoir_podcast(
    db: AsyncSession,
    user_id: uuid.UUID,
    user: User,
    era: Optional[str] = None,
    voice_name: Optional[str] = "Aoede",
    duration_mode: Optional[str] = "standard",
) -> AudioPodcastResponse:
    """
    Produces a documentary audio memoir episode narrated by Gemini.
    """
    stmt = (
        select(Memory)
        .where(Memory.user_id == user_id)
        .order_by(Memory.event_date.asc().nulls_last(), Memory.created_at.asc())
    )
    result = await db.execute(stmt)
    memories: List[Memory] = result.scalars().all()

    if not memories:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cannot generate Audio Memoir: No memories recorded in vault yet.",
        )

    # Filter by era/category if requested
    if era and era.lower() != "all":
        filtered = [m for m in memories if (m.category and m.category.lower() == era.lower())]
        if filtered:
            memories = filtered

    author_name = user.full_name or user.username or "Our Author"

    # Compile memory facts
    facts_summary = "\n\n".join(
        [
            f"Title: {m.title}\nDate: {m.event_date or 'Life Milestone'}\nCategory: {m.category}\nStory: {m.content[:500]}"
            for m in memories[:8]
        ]
    )

    episode_title = f"Echoes of a Journey: The Life of {author_name}"
    script = ""

    # Call Gemini to write the NPR-style documentary audio script
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
        try:
            client = get_gemini_client()
            length_instr = "around 150-250 spoken words" if duration_mode == "highlight" else "around 300-450 spoken words"

            prompt = f"""You are an acclaimed audio documentary producer and master storyteller (like NPR's This American Life).
Craft an emotionally resonant, intimate audio memoir episode celebrating the life story of {author_name}.

True memories from their life:
{facts_summary}

Write a spoken audio script ({length_instr}) with:
1. Warm, captivating audio opening welcoming the listener.
2. Weaving the memories into an inspiring journey of resilience, love, and life milestones.
3. A heartfelt closing reflection leaving an immortal blessing for family and posterity.

Write ONLY the spoken words to be read by the narrator. Do not include sound-effect cues, stage directions, or markdown headers."""

            resp = client.models.generate_content(
                model=settings.GEMINI_LLM_MODEL,
                contents=prompt,
            )
            if resp and resp.text:
                script = resp.text.strip()

        except Exception as e:
            print(f"⚠️ Audio script generation fallback: {e}")

    # Fallback script if Gemini call is unavailable
    if not script:
        script = (
            f"Welcome to this special audio reflection on the life of {author_name}. "
            f"Across {len(memories)} defining milestones, their story is one of enduring values, quiet dignity, and devotion to family. "
            f"From early beginnings to major life turning points, every memory preserved in this archive reminds us that our true legacy "
            f"is found in the love we share and the principles we leave behind for future generations."
        )

    # Synthesize Audio via Gemini TTS
    audio_base64, mime_type = await synthesize_text_to_speech(
        text=script,
        voice_name=voice_name or "Aoede",
    )

    return AudioPodcastResponse(
        title=episode_title,
        script=script,
        voice_name=voice_name or "Aoede",
        audio_base64=audio_base64,
        mime_type=mime_type or "audio/wav",
        chapters_count=len(memories),
    )
