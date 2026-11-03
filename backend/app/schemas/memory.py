"""
Human Legacy AI - Memory Schemas

Pydantic models for memory creation, update, filtering, and API responses.
Includes Blueprint-specific fields (memory_type, importance, verification_status).
"""

import uuid
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class MemoryCreateRequest(BaseModel):
    """Payload for creating a new personal memory."""
    title: str = Field(..., min_length=1, max_length=500, description="Memory title")
    content: str = Field(..., min_length=1, description="Memory narrative or reflection")
    category: Optional[str] = Field(None, max_length=100, description="e.g. Childhood, Career, Philosophy")
    tags: Optional[List[str]] = Field(default_factory=list, description="Keywords or tags")
    memory_type: Optional[str] = Field("episodic", description="episodic, semantic, procedural, value")
    importance: Optional[float] = Field(None, ge=1.0, le=10.0, description="Significance score (1-10)")
    verification_status: Optional[str] = Field("unverified", description="unverified, owner_confirmed, corroborated")
    event_date: Optional[date] = Field(None, description="Date when the event took place (if known, do not invent)")


class MemoryUpdateRequest(BaseModel):
    """Payload for updating an existing memory."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = None
    memory_type: Optional[str] = None
    importance: Optional[float] = Field(None, ge=1.0, le=10.0)
    verification_status: Optional[str] = None
    event_date: Optional[date] = None


class MemoryResponse(BaseModel):
    """Public representation of a memory entry."""
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    content: str
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    memory_type: Optional[str] = "episodic"
    importance: Optional[float] = None
    verification_status: str = "unverified"
    event_date: Optional[date] = None
    source_type: str = "text"
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class MemoryListResponse(BaseModel):
    """Paginated list of memories with total count."""
    total: int
    items: List[MemoryResponse]
    page: int
    page_size: int

