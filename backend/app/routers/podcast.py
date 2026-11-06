"""
Human Legacy AI - Audio Memoir Podcast Router

Generates biographical documentary audio podcast episodes using Gemini narrative synthesis
and Gemini text-to-speech audio streaming.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.schemas.family_podcast import (
    AudioPodcastGenerateRequest,
    AudioPodcastResponse,
)
from app.services.family_podcast_service import generate_audio_memoir_podcast

router = APIRouter(prefix="/api/podcast", tags=["Audio Memoir Podcast"])


@router.post(
    "/generate",
    response_model=AudioPodcastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate an Audio Memoir documentary podcast episode",
)
async def create_audio_podcast(
    payload: AudioPodcastGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Synthesizes a documentary-style audio story from user memories,
    narrated by Gemini with professional audio streaming.
    """
    return await generate_audio_memoir_podcast(
        db=db,
        user_id=current_user.id,
        user=current_user,
        era=payload.era,
        voice_name=payload.voice_name,
        duration_mode=payload.duration_mode,
    )
