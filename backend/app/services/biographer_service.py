"""
Human Legacy AI - AI Biographer Service

Acts as an empathetic master autobiography journalist and interviewer.
Guides users through life eras, synthesizes spoken/raw answers into polished memoir chapters,
and seamlessly registers them into the pgvector memory vault.
"""

import json
import re
import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.config import settings
from app.models.memory import Memory
from app.schemas.memory import MemoryCreateRequest
from app.schemas.biographer import (
    BiographerQuestionItem,
    BiographerTopicsResponse,
    BiographerSynthesizeResponse,
    BiographerSaveRequest,
)
from app.services.embedding_service import get_gemini_client
from app.services.memory_service import create_memory


CURATED_QUESTIONS: List[Dict[str, Any]] = [
    # 1. Early Roots & Childhood
    {
        "id": "early-1",
        "era": "Early Roots & Childhood",
        "category": "Family & Roots",
        "question": "What is the earliest vivid memory from your childhood that still brings emotion to you today?",
        "hint": "Think about the sights, sounds, or smells of your childhood home or a special day you spent outside.",
    },
    {
        "id": "early-2",
        "era": "Early Roots & Childhood",
        "category": "Personal Reflection",
        "question": "Who was your childhood hero or role model, and what did they teach you about the world?",
        "hint": "It could be a parent, grandparent, teacher, or an older sibling.",
    },
    {
        "id": "early-3",
        "era": "Early Roots & Childhood",
        "category": "Family & Roots",
        "question": "What traditions or simple rituals did your family have during meals, festivals, or quiet evenings?",
        "hint": "Recall regular Sunday dinners, bedtime stories, or games you played together.",
    },

    # 2. Family, Parents & Ancestry
    {
        "id": "family-1",
        "era": "Family, Parents & Ancestry",
        "category": "Family & Roots",
        "question": "Tell me a story about your father or mother that captures their personality and spirit best.",
        "hint": "A moment of sacrifice, an unexpected laugh, or a quiet conversation you shared.",
    },
    {
        "id": "family-2",
        "era": "Family, Parents & Ancestry",
        "category": "Wisdom & Philosophy",
        "question": "What was the most important lesson your parents lived by, even if they never said it out loud?",
        "hint": "How did they treat neighbors, face tough times, or show kindness?",
    },
    {
        "id": "family-3",
        "era": "Family, Parents & Ancestry",
        "category": "Family & Roots",
        "question": "What is a story about your grandparents or ancestral roots that you want future generations to never forget?",
        "hint": "Where did your family originate? What hurdles did they overcome?",
    },

    # 3. Turning Points & Major Choices
    {
        "id": "turning-1",
        "era": "Turning Points & Major Choices",
        "category": "Turning Point",
        "question": "What single decision or crossroad altered the trajectory of your life most drastically?",
        "hint": "Moving cities, choosing a career, saying yes to an opportunity, or walking away from something.",
    },
    {
        "id": "turning-2",
        "era": "Turning Points & Major Choices",
        "category": "Personal Reflection",
        "question": "Tell about a time you took a massive risk where failure was very possible. What happened?",
        "hint": "What gave you the courage to take the leap?",
    },
    {
        "id": "turning-3",
        "era": "Turning Points & Major Choices",
        "category": "Career & Achievements",
        "question": "What was your very first job or significant accomplishment, and what did that first milestone feel like?",
        "hint": "Recall the nervousness, pride, or what you bought with your first earned money.",
    },

    # 4. Love, Friendship & Lifelong Bonds
    {
        "id": "bonds-1",
        "era": "Love, Friendship & Lifelong Bonds",
        "category": "Love & Relationships",
        "question": "How did you meet your life partner or closest lifelong companion? What first drew you to them?",
        "hint": "The first glance, the funny miscommunication, or the moment you knew they were special.",
    },
    {
        "id": "bonds-2",
        "era": "Love, Friendship & Lifelong Bonds",
        "category": "Love & Relationships",
        "question": "Who was a friend that stood beside you during your darkest hour? How did they show up for you?",
        "hint": "Recall the power of true loyalty and unspoken understanding.",
    },

    # 5. Adversity, Hardships & Resilience
    {
        "id": "hardship-1",
        "era": "Adversity, Hardships & Resilience",
        "category": "Personal Reflection",
        "question": "What was the most challenging season of your life, and what inner strength carried you through?",
        "hint": "Loss of a loved one, financial stress, health battle, or deep heartbreak.",
    },
    {
        "id": "hardship-2",
        "era": "Adversity, Hardships & Resilience",
        "category": "Wisdom & Philosophy",
        "question": "How did grief or loss reshape how you view the preciousness of everyday life and time?",
        "hint": "What perspectives changed after saying goodbye to someone irreplaceable?",
    },

    # 6. Wisdom, Philosophy & Legacy for Posterity
    {
        "id": "wisdom-1",
        "era": "Wisdom, Philosophy & Legacy for Posterity",
        "category": "Wisdom & Philosophy",
        "question": "If future generations of your family could only remember one piece of advice from you, what would it be?",
        "hint": "The foundational truth you discovered after decades of living.",
    },
    {
        "id": "wisdom-2",
        "era": "Wisdom, Philosophy & Legacy for Posterity",
        "category": "Personal Reflection",
        "question": "Looking back at your entire journey, what are you most profoundly grateful for?",
        "hint": "The blessings, the quiet mornings, the second chances, or the people who loved you.",
    },
]


def get_all_topics() -> BiographerTopicsResponse:
    """Return all life eras and curated biographical questions."""
    eras = list(dict.fromkeys([q["era"] for q in CURATED_QUESTIONS]))
    questions = [BiographerQuestionItem(**q) for q in CURATED_QUESTIONS]
    return BiographerTopicsResponse(eras=eras, questions=questions)


def get_question_by_id(question_id: str) -> Optional[BiographerQuestionItem]:
    """Retrieve a specific question by ID."""
    for q in CURATED_QUESTIONS:
        if q["id"] == question_id:
            return BiographerQuestionItem(**q)
    return None


def select_next_question(era: Optional[str] = None, exclude_id: Optional[str] = None) -> BiographerQuestionItem:
    """Select next question filtered by era."""
    candidates = CURATED_QUESTIONS
    if era:
        candidates = [q for q in candidates if q["era"].lower() == era.lower()]
    if exclude_id and len(candidates) > 1:
        candidates = [q for q in candidates if q["id"] != exclude_id]

    import random
    picked = random.choice(candidates) if candidates else CURATED_QUESTIONS[0]
    return BiographerQuestionItem(**picked)


def _extract_json_from_llm(raw_text: str) -> Dict[str, Any]:
    """Extract and parse JSON object from LLM response text."""
    clean = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
    if match:
        clean = match.group(1).strip()

    try:
        return json.loads(clean)
    except Exception:
        first_brace = clean.find("{")
        last_brace = clean.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            return json.loads(clean[first_brace : last_brace + 1])
        raise ValueError(f"Could not parse valid JSON from LLM: {raw_text[:200]}")


async def synthesize_interview(
    question: str,
    user_response_text: str,
    era: Optional[str] = None,
    category: Optional[str] = None,
) -> BiographerSynthesizeResponse:
    """
    Synthesize user's spoken or raw written response into an authentic first-person memoir prose.
    Uses Gemini LLM when available, with a resilient heuristic fallback for offline/test environments.
    """
    cleaned_input = user_response_text.strip()
    if not cleaned_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User response text cannot be empty.",
        )

    # If Gemini API key is configured, synthesize via Gemini LLM
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
        try:
            client = get_gemini_client()
            prompt = f"""You are a master autobiographical biographer and compassionate life chronicler.
An interviewee was asked the following question about their life:
"{question}"

Here is their raw spoken/written response:
"{cleaned_input}"

Your task is to transform their raw thoughts into a deeply touching, articulate, first-person memoir narrative ("I remember...", "Looking back...").
If the user's response is in Telugu, Hindi, or code-mixed language, craft the memoir title and narrative in that authentic language (Telugu or Hindi) with eloquent, touching expressions.
Preserve all specific names, dates, emotions, and their authentic personality. Do NOT hallucinate false facts, but polish the flow and emotional resonance.

Respond STRICTLY with a valid JSON object matching this schema:
{{
  "title": "Compelling, poignant memoir chapter title (3-6 words)",
  "polished_content": "The beautifully structured first-person memoir story (2-4 paragraphs)",
  "category": "{category or 'Personal Reflection'}",
  "event_date": "YYYY-MM-DD or approximate year if mentioned, else null",
  "importance": 8.5,
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "key_people": ["Person Name 1", "Person Name 2"],
  "follow_up_question": "One thoughtful, gentle follow-up question an expert biographer would ask to uncover more details"
}}

IMPORTANT: Return ONLY the raw JSON object, without any markdown formatting, greetings, or explanations."""

            response = client.models.generate_content(
                model=settings.GEMINI_LLM_MODEL,
                contents=prompt,
            )

            if response and response.text:
                data = _extract_json_from_llm(response.text)
                return BiographerSynthesizeResponse(
                    title=str(data.get("title") or "Life Memoir Chapter"),
                    polished_content=str(data.get("polished_content") or cleaned_input),
                    category=str(data.get("category") or category or "Personal Reflection"),
                    event_date=data.get("event_date") if data.get("event_date") else None,
                    importance=float(data.get("importance") or 8.0),
                    tags=list(data.get("tags") or ["biography", "memoir", "legacy"]),
                    key_people=list(data.get("key_people") or []),
                    follow_up_question=data.get("follow_up_question") or "What feeling remained with you after that day?",
                )

        except Exception as e:
            print(f"⚠️ Biographer Gemini synthesis failed, using heuristic fallback: {e}")

    # Heuristic Fallback (for offline mode or when Gemini key is absent)
    words = cleaned_input.split()
    short_title = " ".join(words[:5]).capitalize().rstrip(".,!?") or "Memoir Reflection"
    return BiographerSynthesizeResponse(
        title=f"Memoir: {short_title}",
        polished_content=cleaned_input,
        category=category or "Personal Reflection",
        event_date=None,
        importance=8.0,
        tags=["memoir", "interview", "legacy", "life-story"],
        key_people=[],
        follow_up_question="How did that experience continue to influence your decisions in later years?",
    )


async def save_biographer_memoir(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: BiographerSaveRequest,
) -> Memory:
    """
    Save the approved memoir entry into PostgreSQL and index with 768-D vector embeddings.
    """
    memory_create = MemoryCreateRequest(
        title=data.title,
        content=data.content,
        category=data.category or "Personal Reflection",
        memory_type="episodic",
        importance=data.importance or 8.0,
        verification_status="owner_confirmed",
        event_date=data.event_date,
        tags=data.tags or ["biographer", "memoir"],
    )

    return await create_memory(
        db=db,
        user_id=user_id,
        data=memory_create,
        source_type="biographer",
    )

