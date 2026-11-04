"""
Human Legacy AI - Chat Service

Manages conversation sessions, message history persistence,
and calls the RAG pipeline to generate grounded AI responses.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.conversation import Conversation, ConversationMessage
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    SourceCitation,
    ConversationResponse,
    ConversationDetailResponse,
    ConversationMessageResponse,
)
from app.services.rag_service import execute_rag_pipeline


async def get_or_create_conversation(
    db: AsyncSession,
    user_id: uuid.UUID,
    conversation_id: Optional[uuid.UUID] = None,
    initial_title: Optional[str] = None,
) -> Conversation:
    """Retrieve an existing conversation or create a new session for the user."""
    if conversation_id:
        stmt = select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
        result = await db.execute(stmt)
        convo = result.scalar_one_or_none()
        if convo:
            return convo

    # Create new conversation session
    title = (initial_title[:60] + "...") if initial_title and len(initial_title) > 60 else (initial_title or "New Conversation")
    convo = Conversation(
        id=uuid.uuid4(),
        user_id=user_id,
        title=title,
    )
    db.add(convo)
    await db.flush()
    return convo


async def process_chat_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    request: ChatRequest,
) -> ChatResponse:
    """
    Handle a user question:
    1. Retrieve or create conversation session
    2. Save user message to database
    3. Run RAG retrieval and answer generation
    4. Save assistant response and source citations
    5. Return grounded response
    """
    # 1. Get or create conversation
    convo = await get_or_create_conversation(
        db=db,
        user_id=user_id,
        conversation_id=request.conversation_id,
        initial_title=request.message,
    )

    # 2. Save user message
    user_msg = ConversationMessage(
        id=uuid.uuid4(),
        conversation_id=convo.id,
        role="user",
        content=request.message.strip(),
        sources=None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_msg)
    await db.flush()

    # 3. Run RAG pipeline
    answer, citations, is_grounded = await execute_rag_pipeline(
        db=db,
        user_id=user_id,
        question=request.message,
        top_k=request.top_k,
        similarity_threshold=request.similarity_threshold,
    )

    # 4. Save assistant message with serialized citations
    serialized_sources = [c.model_dump(mode="json") for c in citations]
    assistant_msg = ConversationMessage(
        id=uuid.uuid4(),
        conversation_id=convo.id,
        role="assistant",
        content=answer,
        sources=serialized_sources,
        created_at=datetime.now(timezone.utc),
    )
    db.add(assistant_msg)

    # Update conversation timestamp
    convo.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return ChatResponse(
        conversation_id=convo.id,
        message_id=assistant_msg.id,
        answer=answer,
        sources=citations,
        is_grounded=is_grounded,
        created_at=assistant_msg.created_at,
    )


async def list_user_conversations(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
) -> List[ConversationResponse]:
    """Retrieve all conversations for the user ordered by recent activity."""
    stmt = (
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(desc(Conversation.updated_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    convos = result.scalars().all()

    items = []
    for c in convos:
        # Count messages in conversation
        count_stmt = select(func.count()).select_from(ConversationMessage).where(
            ConversationMessage.conversation_id == c.id
        )
        msg_count = (await db.execute(count_stmt)).scalar() or 0

        items.append(
            ConversationResponse(
                id=c.id,
                title=c.title,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=msg_count,
            )
        )
    return items


async def get_conversation_details(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ConversationDetailResponse:
    """Retrieve a conversation session with its complete message history."""
    stmt = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
    )
    result = await db.execute(stmt)
    convo = result.scalar_one_or_none()

    if not convo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    msg_responses = [
        ConversationMessageResponse(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            sources=m.sources,
            created_at=m.created_at,
        )
        for m in sorted(convo.messages, key=lambda x: x.created_at)
    ]

    return ConversationDetailResponse(
        id=convo.id,
        title=convo.title,
        created_at=convo.created_at,
        updated_at=convo.updated_at,
        messages=msg_responses,
    )


async def delete_conversation(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """Delete a conversation session and all its messages."""
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    )
    result = await db.execute(stmt)
    convo = result.scalar_one_or_none()

    if not convo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    await db.delete(convo)
    await db.commit()
    return True
