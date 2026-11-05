"""
Human Legacy AI - AI Biographer Schemas
"""

import uuid
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class BiographerQuestionItem(BaseModel):
    id: str = Field(..., description="Unique ID of the question")
    era: str = Field(..., description="Life chapter or era (e.g. Early Roots, Turning Points)")
    category: str = Field(..., description="Associated memory category")
    question: str = Field(..., description="The biographical prompt question")
    hint: Optional[str] = Field(None, description="Inspirational prompt/hint to guide the user's reflection")


class BiographerTopicsResponse(BaseModel):
    eras: List[str]
    questions: List[BiographerQuestionItem]


class BiographerGenerateQuestionRequest(BaseModel):
    era: Optional[str] = Field(None, description="Optional era filter")
    focus_topic: Optional[str] = Field(None, description="Optional custom focus keyword or topic")


class BiographerSynthesizeRequest(BaseModel):
    question: str = Field(..., description="The question asked by the biographer")
    user_response_text: str = Field(..., description="The raw transcript or written answer from user")
    era: Optional[str] = Field(None, description="Era being recorded")
    category: Optional[str] = Field(None, description="Suggested category")


class BiographerSynthesizeResponse(BaseModel):
    title: str = Field(..., description="Memoir chapter title")
    polished_content: str = Field(..., description="Narrative first-person memoir story")
    category: str = Field("Personal Reflection", description="Assigned memory category")
    event_date: Optional[str] = Field(None, description="Extracted date or approximate timeframe")
    importance: float = Field(8.0, description="Significance rating 1-10")
    tags: List[str] = Field(default_factory=list, description="Extracted relevant tags")
    key_people: List[str] = Field(default_factory=list, description="People mentioned in the memoir")
    follow_up_question: Optional[str] = Field(None, description="Suggested next question to deepen the story")


class BiographerSaveRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    category: Optional[str] = Field("Personal Reflection", max_length=100)
    event_date: Optional[date] = None
    importance: Optional[float] = Field(8.0, ge=1.0, le=10.0)
    tags: Optional[List[str]] = Field(default_factory=list)
