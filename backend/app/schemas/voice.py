"""
Human Legacy AI - Voice Fallback Schemas

Data transfer models for Speech-to-Text (STT), Text-to-Speech (TTS),
and the complete Voice Fallback query pipeline.
"""

import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.chat import SourceCitation


class TranscribeResponse(BaseModel):
    """Result of audio transcription."""
    transcript: str
    confidence: Optional[float] = 1.0


class SynthesizeRequest(BaseModel):
    """Request payload for text-to-speech audio synthesis."""
    text: str = Field(..., min_length=1, max_length=2000, description="Text to synthesize")
    voice_name: Optional[str] = Field("Aoede", description="Voice profile name")


class SynthesizeResponse(BaseModel):
    """Synthesized speech audio payload."""
    text: str
    audio_base64: Optional[str] = None
    mime_type: str = "audio/wav"


class VoiceQueryResponse(BaseModel):
    """Complete response for spoken query fallback pipeline."""
    transcript: str
    answer: str
    sources: List[SourceCitation] = []
    is_grounded: bool
    audio_base64: Optional[str] = None
    mime_type: Optional[str] = "audio/wav"
    conversation_id: uuid.UUID
    message_id: uuid.UUID
    created_at: datetime

