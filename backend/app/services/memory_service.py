"""
Human Legacy AI - Memory Service

CRUD operations for user personal memories with strict user-level ownership isolation.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from sqlalchemy import select, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.memory import Memory
from app.schemas.memory import MemoryCreateRequest, MemoryUpdateRequest


async def create_memory(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: MemoryCreateRequest,
    source_type: str = "text"
) -> Memory:
    """Create a new memory entry owned by the authenticated user."""
    memory = Memory(
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
    Preserves existing values for omitted fields.
    """
    memory = await get_memory_by_id(db, memory_id, user_id)

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if value is not None or field in ("category", "tags", "importance", "event_date"):
            setattr(memory, field, value)

    memory.updated_at = datetime.now(timezone.utc)
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
    Raises 404 if not found or unauthorized.
    """
    memory = await get_memory_by_id(db, memory_id, user_id)
    await db.delete(memory)
    await db.commit()
    return True
