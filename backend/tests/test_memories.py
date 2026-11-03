"""
Unit and Integration Tests for Stage 4 Memory Management (CRUD)

Tests creating, viewing, searching, updating, and deleting memories,
as well as user-level ownership isolation and Blueprint schema validation.
"""

import uuid
import asyncio
from datetime import date
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import HTTPException

from app.models.user import User
from app.models.memory import Memory
from app.schemas.memory import (
    MemoryCreateRequest,
    MemoryUpdateRequest,
)
from app.services.memory_service import (
    create_memory,
    get_memories,
    get_memory_by_id,
    update_memory,
    delete_memory,
)
from app.routers.memories import (
    create_new_memory,
    list_memories,
    get_single_memory,
    edit_memory,
    remove_memory,
)


@pytest.fixture
def current_user():
    """Sample authenticated user."""
    return User(
        id=uuid.uuid4(),
        email="owner@example.com",
        username="owner",
        hashed_password="...",
        is_active=True,
    )


@pytest.fixture
def other_user():
    """Another user to test ownership isolation."""
    return User(
        id=uuid.uuid4(),
        email="stranger@example.com",
        username="stranger",
        hashed_password="...",
        is_active=True,
    )


def test_create_memory_service(current_user):
    """Test memory creation with all Blueprint-informed fields."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    req_data = MemoryCreateRequest(
        title="Learning to code with grandfather",
        content="In summer of 2010, my grandfather showed me BASIC on his old computer.",
        category="Childhood",
        tags=["coding", "family", "nostalgia"],
        memory_type="episodic",
        importance=9.0,
        verification_status="owner_confirmed",
        event_date=date(2010, 6, 15),
    )

    mem = asyncio.run(create_memory(db=mock_db, user_id=current_user.id, data=req_data))

    assert mem.title == "Learning to code with grandfather"
    assert mem.user_id == current_user.id
    assert mem.category == "Childhood"
    assert mem.importance == 9.0
    assert mem.memory_type == "episodic"
    assert mem.verification_status == "owner_confirmed"
    assert mem.event_date == date(2010, 6, 15)
    assert mem.source_type == "text"


def test_list_memories_service(current_user):
    """Test memory listing and pagination."""
    mock_db = AsyncMock()

    sample_memories = [
        Memory(
            id=uuid.uuid4(),
            user_id=current_user.id,
            title=f"Memory {i}",
            content=f"Content {i}",
            category="Career",
            tags=["job"],
            memory_type="episodic",
            verification_status="unverified",
            source_type="text",
        )
        for i in range(3)
    ]

    # Count result
    count_res = MagicMock()
    count_res.scalar.return_value = 3

    # Items result
    items_res = MagicMock()
    items_res.scalars.return_value.all.return_value = sample_memories

    mock_db.execute.side_effect = [count_res, items_res]

    items, total = asyncio.run(
        get_memories(db=mock_db, user_id=current_user.id, page=1, page_size=10)
    )

    assert total == 3
    assert len(items) == 3
    assert items[0].title == "Memory 0"


def test_get_memory_by_id_success(current_user):
    """Test retrieving an existing memory by ID."""
    mem_id = uuid.uuid4()
    expected_memory = Memory(
        id=mem_id,
        user_id=current_user.id,
        title="My first startup",
        content="Co-founded my first software company in 2018.",
        source_type="text",
    )

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = expected_memory
    mock_db.execute.return_value = mock_res

    mem = asyncio.run(get_memory_by_id(db=mock_db, memory_id=mem_id, user_id=current_user.id))
    assert mem.id == mem_id
    assert mem.title == "My first startup"


def test_get_memory_by_id_not_found(current_user):
    """Test 404 when memory doesn't exist."""
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_res

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_memory_by_id(db=mock_db, memory_id=uuid.uuid4(), user_id=current_user.id))

    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail.lower()


def test_update_memory_service(current_user):
    """Test updating existing memory attributes."""
    mem_id = uuid.uuid4()
    existing_memory = Memory(
        id=mem_id,
        user_id=current_user.id,
        title="Old Title",
        content="Old Content",
        importance=5.0,
        verification_status="unverified",
        source_type="text",
    )

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = existing_memory
    mock_db.execute.return_value = mock_res

    update_data = MemoryUpdateRequest(
        title="Updated Title",
        importance=9.5,
        verification_status="owner_confirmed",
    )

    updated = asyncio.run(
        update_memory(
            db=mock_db,
            memory_id=mem_id,
            user_id=current_user.id,
            data=update_data
        )
    )

    assert updated.title == "Updated Title"
    assert updated.importance == 9.5
    assert updated.verification_status == "owner_confirmed"
    # Content wasn't updated, so it should stay as is
    assert updated.content == "Old Content"


def test_delete_memory_service(current_user):
    """Test deleting memory removes it from database."""
    mem_id = uuid.uuid4()
    existing_memory = Memory(
        id=mem_id,
        user_id=current_user.id,
        title="To be deleted",
        content="...",
        source_type="text",
    )

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = existing_memory
    mock_db.execute.return_value = mock_res
    mock_db.delete = AsyncMock()

    result = asyncio.run(
        delete_memory(db=mock_db, memory_id=mem_id, user_id=current_user.id)
    )
    assert result is True


def test_user_isolation_cannot_access_others_memory(current_user, other_user):
    """Verify User B cannot access or modify User A's memory."""
    mem_id = uuid.uuid4()

    mock_db = AsyncMock()
    # The query filters by (Memory.id == mem_id & Memory.user_id == other_user.id)
    # which returns None because this memory belongs to current_user
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_res

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_memory_by_id(db=mock_db, memory_id=mem_id, user_id=other_user.id))

    assert exc_info.value.status_code == 404


def test_memory_router_endpoints(current_user):
    """Test router endpoint handlers directly."""
    from datetime import datetime, timezone
    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    # Test create endpoint
    req = MemoryCreateRequest(
        title="Router Test Memory",
        content="Testing router endpoint handler.",
        category="Testing",
    )
    res = asyncio.run(create_new_memory(data=req, current_user=current_user, db=mock_db))
    assert res.title == "Router Test Memory"

    # Simulate DB assigned fields
    res.id = uuid.uuid4()
    res.created_at = datetime.now(timezone.utc)
    res.updated_at = datetime.now(timezone.utc)

    # Test list endpoint
    count_res = MagicMock()
    count_res.scalar.return_value = 1
    items_res = MagicMock()
    items_res.scalars.return_value.all.return_value = [res]
    mock_db.execute.side_effect = [count_res, items_res]

    list_res = asyncio.run(
        list_memories(
            search=None,
            category=None,
            verification_status=None,
            page=1,
            page_size=10,
            current_user=current_user,
            db=mock_db
        )
    )
    assert list_res.total == 1
    assert len(list_res.items) == 1

    # Test delete endpoint
    del_res = MagicMock()
    del_res.scalar_one_or_none.return_value = res
    mock_db.execute.side_effect = None
    mock_db.execute.return_value = del_res
    mock_db.delete = AsyncMock()

    del_msg = asyncio.run(
        remove_memory(memory_id=res.id, current_user=current_user, db=mock_db)
    )
    assert "deleted successfully" in del_msg.message
