"""
Human Legacy AI - Memories Router

REST endpoints for memory creation, listing, searching, editing, and deletion.
Enforces authentication and user ownership on all operations.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.schemas.memory import (
    MemoryCreateRequest,
    MemoryUpdateRequest,
    MemoryResponse,
    MemoryListResponse,
)
from app.schemas.auth import MessageResponse
from app.services.memory_service import (
    create_memory,
    get_memories,
    get_memory_by_id,
    update_memory,
    delete_memory,
)

router = APIRouter(prefix="/api/memories", tags=["Memories"])


@router.post(
    "",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new memory"
)
async def create_new_memory(
    data: MemoryCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new text-based personal memory owned by the logged-in user.
    """
    return await create_memory(db, current_user.id, data)


@router.get(
    "",
    response_model=MemoryListResponse,
    status_code=status.HTTP_200_OK,
    summary="List and filter memories"
)
async def list_memories(
    search: Optional[str] = Query(None, description="Search term in title or content"),
    category: Optional[str] = Query(None, description="Filter by category"),
    verification_status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve paginated memories owned by the authenticated user.
    Supports full-text keyword search and category filtering.
    """
    items, total = await get_memories(
        db,
        current_user.id,
        search=search,
        category=category,
        verification_status=verification_status,
        page=page,
        page_size=page_size
    )
    return MemoryListResponse(
        total=total,
        items=items,
        page=page,
        page_size=page_size
    )


@router.get(
    "/{memory_id}",
    response_model=MemoryResponse,
    status_code=status.HTTP_200_OK,
    summary="View details of a single memory"
)
async def get_single_memory(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve one specific memory by ID.
    User can only access their own memory (404 otherwise).
    """
    return await get_memory_by_id(db, memory_id, current_user.id)


@router.put(
    "/{memory_id}",
    response_model=MemoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing memory"
)
async def edit_memory(
    memory_id: uuid.UUID,
    data: MemoryUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Edit and update an existing memory owned by the user.
    """
    return await update_memory(db, memory_id, current_user.id, data)


@router.delete(
    "/{memory_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a memory"
)
async def remove_memory(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a personal memory and its associated chunks.
    """
    await delete_memory(db, memory_id, current_user.id)
    return MessageResponse(message="Memory deleted successfully.")

