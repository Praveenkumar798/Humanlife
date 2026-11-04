"""
Human Legacy AI - Chat & RAG Schemas

Pydantic models for grounded chat queries, responses, source citations,
and persistent conversation sessions.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SourceCitation(BaseModel):
    """Citation referencing the exact retrieved memory or document chunk."""
    memory_id: uuid.UUID
    memory_title: str
    source_type: str
    filename: Optional[str] = None
    page_number: Optional[int] = None
    chunk_text: str
    similarity_score: float

    model_config = {
        "from_attributes": True
    }


class ChatRequest(BaseModel):
    """User question submitted to the RAG chatbot."""
    message: str = Field(..., min_length=1, description="Question about stored memories")
    conversation_id: Optional[uuid.UUID] = Field(None, description="Optional existing conversation session ID")
    top_k: Optional[int] = Field(None, ge=1, le=20, description="Number of memory chunks to retrieve")
    similarity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum similarity score")


class ChatResponse(BaseModel):
    """Grounded AI answer with source citations."""
    conversation_id: uuid.UUID
    message_id: uuid.UUID
    answer: str
    sources: List[SourceCitation]
    is_grounded: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class ConversationMessageResponse(BaseModel):
    """A message in conversation history."""
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    sources: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class ConversationResponse(BaseModel):
    """A conversation session with metadata."""
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0

    model_config = {
        "from_attributes": True
    }


class ConversationDetailResponse(BaseModel):
    """A conversation session including all historical messages."""
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[ConversationMessageResponse]

    model_config = {
        "from_attributes": True
    }


class ConversationListResponse(BaseModel):
    """List of conversations."""
    total: int
    items: List[ConversationResponse]

