"""
Human Legacy AI - Processing Job Model

Tracks the status of file processing jobs (PDF/TXT extraction, chunking, embedding).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProcessingJob(Base):
    """Tracks processing status for memory/file operations."""

    __tablename__ = "processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    memory_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Status: pending, processing, completed, failed
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )
    # Job type: text_chunking, pdf_extraction, txt_extraction, embedding
    job_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    memory = relationship("Memory", back_populates="processing_jobs")

    def __repr__(self) -> str:
        return f"<ProcessingJob(id={self.id}, status={self.status})>"


class UserSettings(Base):
    """Per-user configurable settings."""

    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    retrieval_chunks: Mapped[int] = mapped_column(
        default=5, nullable=False
    )
    similarity_threshold: Mapped[float] = mapped_column(
        default=0.7, nullable=False
    )
    preferences: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )

    def __repr__(self) -> str:
        return f"<UserSettings(user_id={self.user_id})>"

