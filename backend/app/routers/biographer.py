"""
Human Legacy AI - AI Biographer Router

REST endpoints for proactive life-interview guidance, spoken answer synthesis,
and one-click memory vault persistence.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.schemas.memory import MemoryResponse
from app.schemas.biographer import (
    BiographerTopicsResponse,
    BiographerQuestionItem,
    BiographerSynthesizeRequest,
    BiographerSynthesizeResponse,
    BiographerSaveRequest,
)
from app.services.biographer_service import (
    get_all_topics,
    get_question_by_id,
    select_next_question,
    synthesize_interview,
    save_biographer_memoir,
)

router = APIRouter(prefix="/api/biographer", tags=["AI Biographer"])


@router.get(
    "/topics",
    response_model=BiographerTopicsResponse,
    summary="Get all life chapters and curated biographical questions",
)
async def list_topics(
    current_user: User = Depends(get_current_user),
):
    """Return all life eras and questions for autobiographical interview."""
    return get_all_topics()


@router.get(
    "/question/next",
    response_model=BiographerQuestionItem,
    summary="Get next interview question, optionally filtered by era",
)
async def get_next_question(
    era: Optional[str] = Query(None, description="Optional era filter"),
    exclude_id: Optional[str] = Query(None, description="Optional ID to exclude"),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the next question for the user to answer."""
    return select_next_question(era=era, exclude_id=exclude_id)


@router.get(
    "/question/{question_id}",
    response_model=BiographerQuestionItem,
    summary="Get question details by ID",
)
async def get_question(
    question_id: str,
    current_user: User = Depends(get_current_user),
):
    """Fetch question details by unique ID."""
    q = get_question_by_id(question_id)
    if not q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question '{question_id}' not found.",
        )
    return q


@router.post(
    "/synthesize",
    response_model=BiographerSynthesizeResponse,
    summary="Transform spoken or raw written answers into polished first-person memoir prose",
)
async def synthesize_answer(
    request: BiographerSynthesizeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Transforms interviewee answers into polished autobiography text with extracted metadata
    (Title, Era/Category, Event Date, Importance score, Tags, Key People, Follow-up Question).
    """
    return await synthesize_interview(
        question=request.question,
        user_response_text=request.user_response_text,
        era=request.era,
        category=request.category,
    )


@router.post(
    "/save",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save synthesized memoir chapter into the permanent memory vault with 768-D embeddings",
)
async def save_memoir(
    request: BiographerSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Persists the approved memoir chapter to PostgreSQL and generates vector embeddings
    so it is immediately retrievable by RAG chat and voice assistants.
    """
    return await save_biographer_memoir(
        db=db,
        user_id=current_user.id,
        data=request,
    )
