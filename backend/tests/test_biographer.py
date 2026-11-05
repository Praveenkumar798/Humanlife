"""
Unit and Integration Tests for Stage 13: AI Biographer Voice Interviewer Mode

Tests curated topics retrieval, question filtering, interview answer synthesis (Gemini + fallback),
and saving approved memoir chapters into the memory vault.
"""

import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException

from app.models.user import User
from app.models.memory import Memory
from app.schemas.biographer import (
    BiographerSynthesizeRequest,
    BiographerSaveRequest,
)
from app.services.biographer_service import (
    get_all_topics,
    get_question_by_id,
    select_next_question,
    synthesize_interview,
    save_biographer_memoir,
)
from app.routers.biographer import (
    list_topics,
    get_next_question,
    get_question,
    synthesize_answer,
    save_memoir,
)


@pytest.fixture
def test_user():
    """Sample authenticated user."""
    return User(
        id=uuid.uuid4(),
        email="author@example.com",
        username="memoir_author",
        hashed_password="...",
        is_active=True,
    )


def test_get_all_topics():
    """Verify curated life eras and questions exist and have proper fields."""
    response = get_all_topics()
    assert len(response.eras) >= 5
    assert len(response.questions) >= 10
    first_q = response.questions[0]
    assert first_q.id
    assert first_q.era
    assert first_q.question
    assert first_q.category


def test_select_next_question():
    """Verify next question selection with and without era filtering."""
    q_any = select_next_question()
    assert q_any.id

    era = "Early Roots & Childhood"
    q_era = select_next_question(era=era)
    assert q_era.era == era

    # Exclude id
    q_diff = select_next_question(era=era, exclude_id=q_era.id)
    assert q_diff.id != q_era.id or len([q for q in get_all_topics().questions if q.era == era]) == 1


def test_get_question_by_id():
    """Verify lookup by valid ID and None on invalid."""
    q = get_question_by_id("early-1")
    assert q is not None
    assert q.id == "early-1"

    q_none = get_question_by_id("invalid-non-existent-id")
    assert q_none is None


@pytest.mark.asyncio
async def test_synthesize_interview_fallback(test_user):
    """Verify synthesis works gracefully with fallback when no Gemini API key is configured."""
    with patch("app.services.biographer_service.settings.GEMINI_API_KEY", None):
        res = await synthesize_interview(
            question="What values did your parents instill in you?",
            user_response_text="My parents always told me to be honest and work hard, no matter how tough things got.",
            era="Family, Parents & Ancestry",
            category="Wisdom & Philosophy",
        )
        assert res.title
        assert "honest and work hard" in res.polished_content
        assert res.category == "Wisdom & Philosophy"
        assert res.importance >= 7.0
        assert len(res.tags) > 0


@pytest.mark.asyncio
async def test_synthesize_interview_empty_raises():
    """Verify empty user response raises 400 Bad Request."""
    with pytest.raises(HTTPException) as exc_info:
        await synthesize_interview(
            question="Tell me about your father.",
            user_response_text="   ",
        )
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_synthesize_interview_with_gemini_mock():
    """Verify Gemini LLM JSON synthesis parsing."""
    mock_json_response = (
        '{"title": "The Lessons of Quiet Dignity",'
        '"polished_content": "Looking back, my father always carried himself with a quiet dignity...",'
        '"category": "Family & Roots",'
        '"event_date": "1995-06-12",'
        '"importance": 9.5,'
        '"tags": ["father", "lessons", "dignity"],'
        '"key_people": ["Father"],'
        '"follow_up_question": "What was his reaction when you applied that lesson?"}'
    )

    mock_client = MagicMock()
    mock_model_response = MagicMock()
    mock_model_response.text = mock_json_response
    mock_client.models.generate_content.return_value = mock_model_response

    with patch("app.services.biographer_service.settings.GEMINI_API_KEY", "mock-key"):
        with patch("app.services.biographer_service.get_gemini_client", return_value=mock_client):
            res = await synthesize_interview(
                question="Tell me about your father's lessons.",
                user_response_text="He taught me quiet dignity.",
            )

            assert res.title == "The Lessons of Quiet Dignity"
            assert "quiet dignity" in res.polished_content
            assert res.importance == 9.5
            assert "father" in res.tags
            assert res.key_people == ["Father"]


@pytest.mark.asyncio
async def test_save_biographer_memoir(test_user):
    """Verify saving approved memoir invokes create_memory with source_type='biographer'."""
    mock_db = AsyncMock()

    save_req = BiographerSaveRequest(
        title="A Winter Evening with Dad",
        content="I remember sitting by the hearth listening to dad's stories...",
        category="Family & Roots",
        event_date=date(2020, 1, 15),
        importance=9.0,
        tags=["dad", "winter", "stories"],
    )

    with patch("app.services.biographer_service.create_memory", new_callable=AsyncMock) as mock_create:
        fake_mem = Memory(
            id=uuid.uuid4(),
            user_id=test_user.id,
            title=save_req.title,
            content=save_req.content,
            category=save_req.category,
            source_type="biographer",
        )
        mock_create.return_value = fake_mem

        res = await save_biographer_memoir(
            db=mock_db,
            user_id=test_user.id,
            data=save_req,
        )

        assert res.id == fake_mem.id
        assert res.title == save_req.title
        mock_create.assert_called_once()
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["source_type"] == "biographer"
        assert call_kwargs["data"].title == save_req.title


@pytest.mark.asyncio
async def test_router_endpoints(test_user):
    """Verify router functions for topics, questions, and synthesis."""
    topics = await list_topics(current_user=test_user)
    assert len(topics.eras) > 0

    next_q = await get_next_question(era=None, exclude_id=None, current_user=test_user)
    assert next_q.id

    detail_q = await get_question(question_id="early-1", current_user=test_user)
    assert detail_q.id == "early-1"

    # 404 test
    with pytest.raises(HTTPException) as exc_info:
        await get_question(question_id="does-not-exist", current_user=test_user)
    assert exc_info.value.status_code == 404
