"""
Human Legacy AI - Memory Service

CRUD operations for user personal memories with strict user-level ownership isolation.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from sqlalchemy import select, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.config import settings
from app.models.memory import Memory
from app.models.chunk import MemoryChunk, SourceFile
from app.schemas.memory import MemoryCreateRequest, MemoryUpdateRequest
from app.utils.chunking import chunk_text
from app.services.embedding_service import generate_embeddings_batch


async def _sync_memory_chunks(
    db: AsyncSession,
    memory_id: uuid.UUID,
    user_id: uuid.UUID,
    title: str,
    content: str,
    source_type: str = "text"
) -> None:
    """Helper to chunk memory content, generate embeddings, and persist chunks."""
    # Delete any existing chunks for this memory first
    try:
        existing_chunks_stmt = select(MemoryChunk).where(MemoryChunk.memory_id == memory_id)
        result = await db.execute(existing_chunks_stmt)
        if hasattr(result, "scalars"):
            sc = result.scalars()
            if hasattr(sc, "all"):
                chunks_to_del = sc.all()
                if not hasattr(chunks_to_del, "__await__"):
                    for chk in chunks_to_del:
                        await db.delete(chk)
    except Exception as e:
        print(f"⚠️ Warning: Could not clean old chunks: {e}")

    # Chunk the memory text
    chunks_data = chunk_text(
        text=content,
        chunk_size=600,
        overlap=100,
        base_metadata={"memory_title": title, "source_type": source_type}
    )

    if not chunks_data:
        return

    # Generate embeddings if Gemini API key is available
    embeddings = None
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
        try:
            texts = [c["content"] for c in chunks_data]
            embeddings = await generate_embeddings_batch(texts)
        except Exception as e:
            print(f"⚠️ Warning: Embedding generation for text memory skipped: {e}")

    # Save chunks
    for idx, c in enumerate(chunks_data):
        emb = embeddings[idx] if (embeddings and idx < len(embeddings)) else None
        chunk_record = MemoryChunk(
            id=uuid.uuid4(),
            memory_id=memory_id,
            user_id=user_id,
            content=c["content"],
            chunk_index=c["chunk_index"],
            chunk_metadata=c.get("metadata"),
            model_name=settings.GEMINI_EMBEDDING_MODEL if emb else None,
            model_version="1" if emb else None,
            embedding=emb,
        )
        db.add(chunk_record)


async def create_memory(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: MemoryCreateRequest,
    source_type: str = "text"
) -> Memory:
    """Create a new memory entry owned by the authenticated user and index it for RAG."""
    memory = Memory(
        id=uuid.uuid4(),
        user_id=user_id,
        title=data.title.strip(),
        content=data.content.strip(),
        category=data.category.strip() if data.category else None,
        tags=data.tags or [],
        memory_type=data.memory_type or "episodic",
        importance=data.importance,
        verification_status=data.verification_status or "unverified",
        event_date=data.event_date,
        source_type=source_type,
    )
    db.add(memory)
    await db.flush()

    # Automatically chunk and embed text memory for RAG retrieval
    await _sync_memory_chunks(
        db=db,
        memory_id=memory.id,
        user_id=user_id,
        title=memory.title,
        content=memory.content,
        source_type=source_type
    )

    await db.commit()
    await db.refresh(memory)
    return memory


async def get_memories(
    db: AsyncSession,
    user_id: uuid.UUID,
    search: Optional[str] = None,
    category: Optional[str] = None,
    verification_status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
) -> Tuple[List[Memory], int]:
    """
    Retrieve paginated memories owned by the user, with optional search and filters.
    Strictly filters by user_id so users never see other people's memories.
    """
    query = select(Memory).where(Memory.user_id == user_id)

    # Optional keyword search in title or content
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Memory.title).like(search_term),
                func.lower(Memory.content).like(search_term)
            )
        )

    # Optional category filter
    if category:
        query = query.where(func.lower(Memory.category) == category.strip().lower())

    # Optional verification status filter
    if verification_status:
        query = query.where(Memory.verification_status == verification_status.strip().lower())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Paginate and order by newest first
    offset = (page - 1) * page_size
    paged_query = query.order_by(desc(Memory.created_at)).offset(offset).limit(page_size)
    result = await db.execute(paged_query)
    items = list(result.scalars().all())

    return items, total


async def get_memory_by_id(
    db: AsyncSession,
    memory_id: uuid.UUID,
    user_id: uuid.UUID
) -> Memory:
    """
    Retrieve a single memory by ID, enforcing ownership check.
    Raises 404 if memory doesn't exist or does not belong to the user.
    """
    stmt = select(Memory).where(Memory.id == memory_id, Memory.user_id == user_id)
    result = await db.execute(stmt)
    memory = result.scalar_one_or_none()

    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found."
        )

    return memory


async def update_memory(
    db: AsyncSession,
    memory_id: uuid.UUID,
    user_id: uuid.UUID,
    data: MemoryUpdateRequest
) -> Memory:
    """
    Update memory fields if owned by the user.
    Preserves existing values for omitted fields and re-indexes chunks if content changed.
    """
    memory = await get_memory_by_id(db, memory_id, user_id)

    update_dict = data.model_dump(exclude_unset=True)
    content_changed = "content" in update_dict and update_dict["content"] != memory.content

    for field, value in update_dict.items():
        if value is not None or field in ("category", "tags", "importance", "event_date"):
            setattr(memory, field, value)

    memory.updated_at = datetime.now(timezone.utc)

    # If content or title changed, re-sync vector chunks
    if content_changed:
        await _sync_memory_chunks(
            db=db,
            memory_id=memory.id,
            user_id=user_id,
            title=memory.title,
            content=memory.content,
            source_type=memory.source_type
        )

    await db.commit()
    await db.refresh(memory)
    return memory


async def delete_memory(
    db: AsyncSession,
    memory_id: uuid.UUID,
    user_id: uuid.UUID
) -> bool:
    """
    Delete a memory entry and its cascading chunks/files.
    Cleans up physical uploaded file from disk if present.
    Raises 404 if not found or unauthorized.
    """
    memory = await get_memory_by_id(db, memory_id, user_id)

    # Check if there is an associated source file on disk
    try:
        sf_stmt = select(SourceFile).where(SourceFile.memory_id == memory_id)
        sf_result = await db.execute(sf_stmt)
        if hasattr(sf_result, "scalar_one_or_none"):
            source_file = sf_result.scalar_one_or_none()
            if (
                source_file
                and hasattr(source_file, "file_path")
                and source_file.file_path
                and os.path.exists(source_file.file_path)
            ):
                try:
                    os.remove(source_file.file_path)
                except Exception as e:
                    print(f"⚠️ Warning: Could not remove physical file {source_file.file_path}: {e}")
    except Exception:
        pass

    await db.delete(memory)
    await db.commit()
    return True

