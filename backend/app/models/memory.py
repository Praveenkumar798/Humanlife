"""
Human Legacy AI - Memory Model

Stores personal memories with metadata, categories, and verification status.
Blueprint-informed: includes memory_type, importance, and verification_status fields.
"""

import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Text, DateTime, Date, Float, SmallInteger, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Memory(Base):
    """A personal memory entry owned by a user."""

    __tablename__ = "memories"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False
    )
    category: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    tags: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=list
    )
    # Blueprint field: episodic, semantic, procedural, value
    memory_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default="episodic"
    )
    # Blueprint field: owner-rated significance (1-10)
    importance: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    # Blueprint field: unverified, owner_confirmed, corroborated, disputed, corrected
    verification_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="unverified"
    )
    # Event date (user-provided, NOT auto-generated)
    event_date: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )
    # Source type: text, pdf, txt
    source_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="text"
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
    user = relationship("User", back_populates="memories")
    chunks = relationship("MemoryChunk", back_populates="memory", cascade="all, delete-orphan")
    source_file = relationship("SourceFile", back_populates="memory", uselist=False, cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="memory", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Memory(id={self.id}, title={self.title[:30]})>"

