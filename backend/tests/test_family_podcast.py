"""
Unit and Integration Tests for Stage 16: Family Sharing & Audio Memoir Podcast Generator

Tests tokenized public tribute portal access, guest RAG chat with cognitive replica,
and biographical audio memoir podcast production.
"""

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest  # type: ignore
from fastapi import HTTPException  # type: ignore

from app.models.user import User
from app.models.memory import Memory
from app.models.family_share import FamilyShare
from app.schemas.chat import SourceCitation
from app.services.family_podcast_service import (
    get_or_create_family_share,
    update_family_share,
    regenerate_family_share_token,
    get_public_legacy_profile,
    execute_public_family_chat,
    generate_audio_memoir_podcast,
)


@pytest.fixture
def current_user():
    return User(
        id=uuid.uuid4(),
        email="grandparent@example.com",
        username="grandpa_ram",
        full_name="Ramachandra Rao",
        hashed_password="...",
        is_active=True,
    )


@pytest.fixture
def sample_memories(current_user):
    return [
        Memory(
            id=uuid.uuid4(),
            user_id=current_user.id,
            title="Growing up in Vijayawada",
            content="We lived by the Krishna river. My grandfather taught me to swim and taught me honesty above all else.",
            category="Family & Roots",
            event_date=date(1955, 6, 12),
            importance=9.5,
            source_type="text",
            tags=["river", "grandfather", "honesty"],
            created_at=datetime.now(timezone.utc),
        ),
        Memory(
            id=uuid.uuid4(),
            user_id=current_user.id,
            title="Building My First Business",
            content="With just 500 rupees, I opened my small electrical repairs shop in 1978. Hard work was my only asset.",
            category="Turning Point",
            event_date=date(1978, 10, 5),
            importance=8.5,
            source_type="text",
            tags=["business", "hardwork"],
            created_at=datetime.now(timezone.utc),
        ),
    ]


@pytest.mark.asyncio
async def test_get_or_create_family_share(current_user):
    """Verify share link creation generates a unique token."""
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_res

    share = await get_or_create_family_share(
        db=mock_db,
        user_id=current_user.id,
        label="Kids and Grandkids",
        allow_chat=True,
    )

    assert share.share_token
    assert len(share.share_token) >= 16
    assert share.label == "Kids and Grandkids"
    assert share.is_active is True
    assert share.allow_chat is True


@pytest.mark.asyncio
async def test_update_and_regenerate_family_share(current_user):
    """Verify updating label, toggling active status, and regenerating token."""
    mock_db = AsyncMock()
    existing_share = FamilyShare(
        id=uuid.uuid4(),
        user_id=current_user.id,
        share_token="old-token-12345",
        label="Old Label",
        is_active=True,
        allow_chat=True,
    )

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = existing_share
    mock_db.execute.return_value = mock_res

    updated = await update_family_share(
        db=mock_db,
        user_id=current_user.id,
        share_token="old-token-12345",
        label="New Family Tribute",
        allow_chat=False,
    )
    assert updated.label == "New Family Tribute"
    assert updated.allow_chat is False

    # Regenerate
    regenerated = await regenerate_family_share_token(
        db=mock_db,
        user_id=current_user.id,
        old_token="old-token-12345",
    )
    assert regenerated.share_token != "old-token-12345"


@pytest.mark.asyncio
async def test_get_public_legacy_profile(current_user, sample_memories):
    """Verify public guest lookup returns memories and author name without authentication."""
    mock_db = AsyncMock()
    share = FamilyShare(
        id=uuid.uuid4(),
        user_id=current_user.id,
        share_token="family-secret-xyz",
        label="Beloved Family",
        is_active=True,
        allow_chat=True,
        views_count=5,
    )

    res_share = MagicMock()
    res_share.scalar_one_or_none.return_value = share

    res_user = MagicMock()
    res_user.scalar_one_or_none.return_value = current_user

    res_mem = MagicMock()
    res_mem.scalars.return_value.all.return_value = sample_memories

    mock_db.execute.side_effect = [res_share, res_user, res_mem]

    profile = await get_public_legacy_profile(db=mock_db, share_token="family-secret-xyz")

    assert profile.author_name == "Ramachandra Rao"
    assert profile.total_memories == 2
    assert profile.memories[0].title == "Growing up in Vijayawada"
    assert profile.allow_chat is True
    # Views count incremented
    assert share.views_count == 6


@pytest.mark.asyncio
async def test_public_legacy_invalid_token_raises_404():
    """Verify non-existent or inactive share token raises 404."""
    mock_db = AsyncMock()
    res_none = MagicMock()
    res_none.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = res_none

    with pytest.raises(HTTPException) as exc_info:
        await get_public_legacy_profile(db=mock_db, share_token="does-not-exist")

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_execute_public_family_chat(current_user):
    """Verify family members can query the replica with evidence grounding."""
    mock_db = AsyncMock()
    share = FamilyShare(
        id=uuid.uuid4(),
        user_id=current_user.id,
        share_token="family-secret-xyz",
        label="Beloved Family",
        is_active=True,
        allow_chat=True,
    )

    res_share = MagicMock()
    res_share.scalar_one_or_none.return_value = share

    res_user = MagicMock()
    res_user.scalar_one_or_none.return_value = current_user

    mock_db.execute.side_effect = [res_share, res_user]

    fake_citations = [
        SourceCitation(
            memory_id=uuid.uuid4(),
            memory_title="Growing up in Vijayawada",
            source_type="text",
            chunk_text="We lived by the Krishna river. My grandfather taught me to swim.",
            similarity_score=0.88,
        )
    ]

    with patch("app.services.family_podcast_service.generate_embedding", new_callable=AsyncMock) as mock_emb:
        mock_emb.return_value = [0.1] * 768
        with patch("app.services.family_podcast_service.search_relevant_chunks", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = fake_citations
            with patch("app.services.family_podcast_service.generate_grounded_answer", new_callable=AsyncMock) as mock_gen:
                mock_gen.return_value = ("I learned to swim in the Krishna river with my grandfather.", True)

                res = await execute_public_family_chat(
                    db=mock_db,
                    share_token="family-secret-xyz",
                    question="Where did you learn to swim?",
                )

                assert "Krishna river" in res.answer
                assert res.author_name == "Ramachandra Rao"
                assert "Growing up in Vijayawada" in res.citations


@pytest.mark.asyncio
async def test_generate_audio_memoir_podcast(current_user, sample_memories):
    """Verify audio memoir podcast episode script and audio generation."""
    mock_db = AsyncMock()
    res_mem = MagicMock()
    res_mem.scalars.return_value.all.return_value = sample_memories
    mock_db.execute.return_value = res_mem

    with patch("app.services.family_podcast_service.synthesize_text_to_speech", new_callable=AsyncMock) as mock_tts:
        mock_tts.return_value = ("fake-base64-audio-bytes", "audio/wav")

        podcast = await generate_audio_memoir_podcast(
            db=mock_db,
            user_id=current_user.id,
            user=current_user,
            era="all",
            voice_name="Aoede",
            duration_mode="standard",
        )

        assert "Ramachandra Rao" in podcast.title
        assert len(podcast.script) > 50
        assert podcast.voice_name == "Aoede"
        assert podcast.audio_base64 == "fake-base64-audio-bytes"
        assert podcast.chapters_count == 2
