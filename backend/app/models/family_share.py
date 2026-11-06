"""
Human Legacy AI - Family Share Model

Enables secure, tokenized read-only sharing of memories and cognitive replica chat
with children, grandchildren, and family members without requiring account login.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class FamilyShare(Base):
    """A secure share link for family members to view and query a user's legacy."""

    __tablename__ = "family_shares"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    share_token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(
        String(150), default="Family & Loved Ones", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    allow_chat: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    views_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<FamilyShare(id={self.id}, token={self.share_token}, active={self.is_active})>"
