"""
Human Legacy AI - Family Share & Audio Memoir Podcast Schemas
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FamilyShareCreateRequest(BaseModel):
    label: Optional[str] = Field("Family & Loved Ones", max_length=150)
    allow_chat: Optional[bool] = Field(True, description="Allow family guests to converse with Cognitive Replica")


class FamilyShareUpdateRequest(BaseModel):
    label: Optional[str] = None
    is_active: Optional[bool] = None
    allow_chat: Optional[bool] = None


class FamilyShareResponse(BaseModel):
    id: uuid.UUID
    share_token: str
    label: str
    is_active: bool
    allow_chat: bool
    views_count: int
    created_at: datetime
    share_url: Optional[str] = None

    model_config = {
        "from_attributes": True
    }


class PublicLegacyTimelineItem(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    category: Optional[str] = None
    event_date: Optional[str] = None
    importance: Optional[float] = None
    source_type: str = "text"
    tags: Optional[List[str]] = Field(default_factory=list)


class PublicLegacyProfileResponse(BaseModel):
    author_name: str
    author_username: str
    label: str
    allow_chat: bool
    total_memories: int
    memories: List[PublicLegacyTimelineItem]


class PublicChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list)


class PublicChatResponse(BaseModel):
    answer: str
    author_name: str
    citations: List[str] = Field(default_factory=list)


class AudioPodcastGenerateRequest(BaseModel):
    era: Optional[str] = Field(None, description="Optional life era filter")
    voice_name: Optional[str] = Field("Aoede", description="Voice persona: Aoede, Puck, Charon, Kore, Fenrir")
    duration_mode: Optional[str] = Field("standard", description="'highlight' (1-2 min) or 'standard' (3-5 min)")


class AudioPodcastResponse(BaseModel):
    title: str
    script: str
    voice_name: str
    audio_base64: Optional[str] = None
    mime_type: str = "audio/wav"
    chapters_count: int = 0
