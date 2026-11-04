"""
Human Legacy AI - Voice Fallback Router

Endpoints for the Stage 10 voice fallback architecture:
- POST /api/voice/transcribe (STT)
- POST /api/voice/synthesize (TTS)
- POST /api/voice/query (Combined STT + RAG + TTS pipeline)
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.schemas.voice import (
    TranscribeResponse,
    SynthesizeRequest,
    SynthesizeResponse,
    VoiceQueryResponse,
)
from app.services.voice_fallback_service import (
    transcribe_audio_bytes,
    synthesize_text_to_speech,
    execute_voice_query_pipeline,
)

router = APIRouter(prefix="/api/voice", tags=["Voice Fallback"])


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Speech-to-Text (STT) endpoint.
    Accepts an uploaded audio file (WAV, MP3, WebM, OGG) and transcribes using Gemini.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty.",
        )

    mime_type = file.content_type or "audio/webm"
    transcript = await transcribe_audio_bytes(audio_bytes=audio_bytes, mime_type=mime_type)

    return TranscribeResponse(
        transcript=transcript,
        confidence=1.0,
    )


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize_speech_endpoint(
    request: SynthesizeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Text-to-Speech (TTS) endpoint.
    Synthesizes speech audio from text using Gemini.
    If server audio is unavailable, audio_base64 is None so frontend uses browser Web Speech API.
    """
    audio_b64, mime = await synthesize_text_to_speech(
        text=request.text,
        voice_name=request.voice_name or "Aoede",
    )

    return SynthesizeResponse(
        text=request.text,
        audio_base64=audio_b64,
        mime_type=mime,
    )


@router.post("/query", response_model=VoiceQueryResponse)
async def voice_query_fallback_endpoint(
    audio: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    conversation_id: Optional[str] = Form(None),
    voice_name: Optional[str] = Form("Aoede"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Complete Fallback Voice Pipeline endpoint:
    Accepts either an audio recording or text query, transcribes, runs RAG against
    user memories, synthesizes answer speech, and saves conversation.
    """
    audio_bytes = None
    mime_type = "audio/webm"

    if audio:
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/webm"

    convo_uuid = None
    if conversation_id:
        try:
            convo_uuid = uuid.UUID(conversation_id)
        except (ValueError, TypeError):
            pass

    response = await execute_voice_query_pipeline(
        db=db,
        user_id=current_user.id,
        audio_bytes=audio_bytes,
        mime_type=mime_type,
        text_query=text,
        conversation_id=convo_uuid,
        voice_name=voice_name or "Aoede",
    )

    return response
