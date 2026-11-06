"""
Human Legacy AI - Authentication Schemas

Pydantic models for user registration, login, and responses.
"""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    """Payload for registering a new user account."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class UserLoginRequest(BaseModel):
    """Payload for logging into an account."""
    email_or_username: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1)


class GoogleAuthRequest(BaseModel):
    """Payload for Google OAuth / One-Tap authentication."""
    credential: str = Field(..., min_length=10, description="Google ID Token JWT")



class UserResponse(BaseModel):
    """Safe public user representation (no passwords or secrets)."""
    id: uuid.UUID
    email: str
    username: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class MessageResponse(BaseModel):
    """Standard message response."""
    message: str

