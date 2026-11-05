"""
Unit and Integration Tests for Stage 15: One-Click 'Export My Legacy Book' PDF Generator

Tests chronological memoir assembly, ReportLab canvas page numbering,
PDF byte output, and router download endpoints.
"""

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import HTTPException

from app.models.user import User
from app.models.memory import Memory
from app.services.memoir_pdf_service import generate_memoir_book_pdf
from app.routers.export import download_memoir_pdf


@pytest.fixture
def current_user():
    """Sample authenticated author."""
    return User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="legacy_author",
        full_name="Dr. Eleanor Vance",
        hashed_password="...",
        is_active=True,
    )


@pytest.fixture
def sample_memories(current_user):
    """Sample memories spanning different eras and dates."""
    return [
        Memory(
            id=uuid.uuid4(),
            user_id=current_user.id,
            title="Earliest Childhood Memories in Hyderabad",
            content="I remember the monsoons in Hyderabad, sitting by the stone courtyard watching the rain...",
            category="Family & Roots",
            event_date=date(1985, 7, 10),
            importance=9.0,
            source_type="text",
            tags=["childhood", "hyderabad", "rain"],
            created_at=datetime.now(timezone.utc),
        ),
        Memory(
            id=uuid.uuid4(),
            user_id=current_user.id,
            title="The Decision to Study Engineering",
            content="Moving across the country to pursue my university degree was the first big risk of my life.",
            category="Turning Point",
            event_date=date(2003, 8, 20),
            importance=8.5,
            source_type="text",
            tags=["university", "career", "risk"],
            created_at=datetime.now(timezone.utc),
        ),
        Memory(
            id=uuid.uuid4(),
            user_id=current_user.id,
            title="Our Wedding Day Portrait",
            content="A quiet morning surrounded by loved ones. A day of joyful laughter and timeless vows.",
            category="Love & Relationships",
            event_date=date(2010, 11, 24),
            importance=10.0,
            source_type="photo",
            tags=["wedding", "family", "vows"],
            created_at=datetime.now(timezone.utc),
        ),
    ]


@pytest.mark.asyncio
async def test_generate_memoir_book_pdf_success(current_user, sample_memories):
    """Verify PDF generator produces valid PDF bytes starting with %PDF-."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = sample_memories
    mock_db.execute.return_value = mock_result

    pdf_bytes = await generate_memoir_book_pdf(
        db=mock_db,
        user_id=current_user.id,
        user=current_user,
        book_title="The Life and Times of Eleanor",
        include_prologue=True,
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    # PDF magic bytes
    assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_generate_memoir_book_pdf_empty_raises_404(current_user):
    """Verify empty memory vault raises 404 HTTPException."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    with pytest.raises(HTTPException) as exc_info:
        await generate_memoir_book_pdf(
            db=mock_db,
            user_id=current_user.id,
            user=current_user,
        )

    assert exc_info.value.status_code == 404
    assert "No memories recorded" in exc_info.value.detail


@pytest.mark.asyncio
async def test_download_memoir_pdf_endpoint(current_user, sample_memories):
    """Verify export router endpoint returns attachment headers and PDF content type."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = sample_memories
    mock_db.execute.return_value = mock_result

    response = await download_memoir_pdf(
        book_title=None,
        include_prologue=True,
        current_user=current_user,
        db=mock_db,
    )

    assert response.status_code == 200
    assert response.headers["Content-Type"] == "application/pdf"
    assert "attachment; filename=" in response.headers["Content-Disposition"]
    assert response.body.startswith(b"%PDF-")
