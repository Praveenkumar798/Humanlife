"""
Human Legacy AI - Chat Router

Provides endpoints for RAG-grounded question answering and
managing persistent conversation history.
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    ConversationDetailResponse,
)
from app.schemas.auth import MessageResponse
from app.services.chat_service import (
    process_chat_message,
    list_user_conversations,
    get_conversation_details,
    delete_conversation,
)

router = APIRouter(tags=["Chat & Conversations"])


@router.post(
    "/api/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit a question to the RAG chatbot and receive a grounded answer with citations"
)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    RAG Chatbot Endpoint:
    1. Embeds question with Gemini text-embedding-004
    2. Retrieves top-k matching memory chunks from pgvector (filtered by authenticated user)
    3. Prompts Gemini LLM with strict grounding instructions
    4. Cites source memory titles and document page numbers
    5. Returns answer, citation metadata, and persists the conversation
    """
    return await process_chat_message(
        db=db,
        user_id=current_user.id,
        request=request,
    )


@router.get(
    "/api/conversations",
    response_model=List[ConversationResponse],
    status_code=status.HTTP_200_OK,
    summary="List all conversation sessions for the current user"
)
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all conversations for the user ordered by recent activity."""
    return await list_user_conversations(db=db, user_id=current_user.id)


@router.get(
    "/api/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get conversation details and full message history"
)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full message history for a specific conversation session."""
    return await get_conversation_details(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user.id,
    )


@router.delete(
    "/api/conversations/{conversation_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a conversation and its messages"
)
async def remove_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a conversation session and all its messages."""
    await delete_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user.id,
    )
    return MessageResponse(message="Conversation deleted successfully.")
