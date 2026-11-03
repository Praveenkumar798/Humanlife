"""
Human Legacy AI - Memory Chunk Model

Stores text chunks from memories with vector embeddings for RAG retrieval.
Uses pgvector for semantic similarity search.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.database import Base
from app.config import settings


class MemoryChunk(Base):
    """A text chunk from a memory, with its vector embedding."""

    __tablename__ = "memory_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    memory_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("source_files.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    # Metadata: page number, source info, etc.
    chunk_metadata: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )
    # Blueprint: track which model created the embedding
    model_name: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    model_version: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    # Vector embedding stored via pgvector
    embedding = mapped_column(
        Vector(settings.EMBEDDING_DIMENSIONS), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    memory = relationship("Memory", back_populates="chunks")

    def __repr__(self) -> str:
        return f"<MemoryChunk(id={self.id}, chunk_index={self.chunk_index})>"


class SourceFile(Base):
    """An uploaded file (PDF, TXT) associated with a memory."""

    __tablename__ = "source_files"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    memory_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("memories.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    file_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    file_path: Mapped[str] = mapped_column(
        String(1000), nullable=False
    )
    file_size: Mapped[int] = mapped_column(
        nullable=False
    )
    # Processing status: pending, processing, completed, failed
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )
    checksum: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    memory = relationship("Memory", back_populates="source_file")

    def __repr__(self) -> str:
        return f"<SourceFile(id={self.id}, filename={self.filename})>"

