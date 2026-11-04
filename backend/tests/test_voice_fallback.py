"""
Unit and Integration Tests for Stage 10: STT + RAG + TTS Voice Fallback Pipeline

Tests:
1. Speech-to-Text audio validation (empty audio rejected with 400)
2. Speech-to-Text transcription with mock Gemini response
3. Text-to-Speech audio synthesis with mock Gemini response
4. Text-to-Speech graceful fallback when model audio is unavailable
5. Full voice query pipeline execution (transcribe + RAG + synthesize)
6. Router endpoints: /api/voice/transcribe, /api/voice/synthesize, /api/voice/query
"""

import io
import uuid
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException, UploadFile

from app.models.user import User
from app.schemas.chat import ChatResponse, SourceCitation
from app.schemas.voice import SynthesizeRequest
from app.services.voice_fallback_service import (
    transcribe_audio_bytes,
    synthesize_text_to_speech,
    execute_voice_query_pipeline,
)
from app.routers.voice_fallback import (
    transcribe_audio_endpoint,
    synthesize_speech_endpoint,
    voice_query_fallback_endpoint,
)


@pytest.fixture
def fallback_user():
    """Sample authenticated test user."""
    return User(
        id=uuid.uuid4(),
        email="fallback_user@example.com",
        username="fallback_user",
        hashed_password="...",
        is_active=True,
    )


def test_transcribe_audio_empty_rejected():
    """Verify empty audio bytes are rejected with 400 Bad Request."""
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(transcribe_audio_bytes(b"", mime_type="audio/webm"))
    assert exc_info.value.status_code == 400


def test_transcribe_audio_success():
    """Verify Gemini STT transcription extracts spoken text properly."""
    mock_client = MagicMock()
    mock_res = MagicMock()
    mock_res.text = "Tell me about my graduation day."
    mock_client.models.generate_content.return_value = mock_res

    with patch("app.services.voice_fallback_service.get_gemini_client", return_value=mock_client):
        result = asyncio.run(transcribe_audio_bytes(b"dummy_pcm_bytes", mime_type="audio/wav"))
        assert result == "Tell me about my graduation day."


def test_synthesize_text_to_speech_success():
    """Verify Gemini TTS audio synthesis returns encoded base64 audio."""
    mock_client = MagicMock()
    mock_part = MagicMock()
    mock_part.inline_data.data = b"RIFF....WAVEfmt..."
    mock_part.inline_data.mime_type = "audio/wav"

    mock_candidate = MagicMock()
    mock_candidate.content.parts = [mock_part]

    mock_res = MagicMock()
    mock_res.candidates = [mock_candidate]
    mock_client.models.generate_content.return_value = mock_res

    with patch("app.services.voice_fallback_service.get_gemini_client", return_value=mock_client):
        audio_b64, mime = asyncio.run(synthesize_text_to_speech("Hello world", voice_name="Aoede"))
        assert audio_b64 is not None
        assert mime == "audio/wav"


def test_synthesize_text_to_speech_graceful_fallback():
    """Verify that if Gemini audio generation fails, it returns (None, 'audio/wav') safely."""
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("Model audio output not supported in this region")

    with patch("app.services.voice_fallback_service.get_gemini_client", return_value=mock_client):
        audio_b64, mime = asyncio.run(synthesize_text_to_speech("Hello world"))
        assert audio_b64 is None
        assert mime == "audio/wav"


def test_execute_voice_query_pipeline_with_audio(fallback_user):
    """Verify end-to-end voice query flow with audio input."""
    mock_db = AsyncMock()
    convo_id = uuid.uuid4()
    msg_id = uuid.uuid4()

    mock_chat_resp = ChatResponse(
        conversation_id=convo_id,
        message_id=msg_id,
        answer="You graduated with honors in 2012.",
        sources=[
            SourceCitation(
                memory_id=uuid.uuid4(),
                memory_title="Graduation",
                source_type="text",
                similarity_score=0.91,
                chunk_text="Graduated in 2012 with honors.",
            )
        ],
        is_grounded=True,
        created_at=datetime.now(timezone.utc),
    )

    with patch("app.services.voice_fallback_service.transcribe_audio_bytes", new_callable=AsyncMock) as mock_stt, \
         patch("app.services.voice_fallback_service.process_chat_message", new_callable=AsyncMock) as mock_rag, \
         patch("app.services.voice_fallback_service.synthesize_text_to_speech", new_callable=AsyncMock) as mock_tts:

        mock_stt.return_value = "When did I graduate?"
        mock_rag.return_value = mock_chat_resp
        mock_tts.return_value = ("base64audiodata==", "audio/wav")

        result = asyncio.run(
            execute_voice_query_pipeline(
                db=mock_db,
                user_id=fallback_user.id,
                audio_bytes=b"raw_audio",
                mime_type="audio/wav",
            )
        )

        assert result.transcript == "When did I graduate?"
        assert result.answer == "You graduated with honors in 2012."
        assert result.is_grounded is True
        assert len(result.sources) == 1
        assert result.audio_base64 == "base64audiodata=="


def test_voice_fallback_router_transcribe(fallback_user):
    """Test POST /api/voice/transcribe router endpoint handler."""
    mock_file = MagicMock(spec=UploadFile)
    mock_file.read = AsyncMock(return_value=b"some_audio_bytes")
    mock_file.content_type = "audio/wav"

    with patch("app.routers.voice_fallback.transcribe_audio_bytes", new_callable=AsyncMock) as mock_stt:
        mock_stt.return_value = "Hello from audio"
        res = asyncio.run(transcribe_audio_endpoint(file=mock_file, current_user=fallback_user))
        assert res.transcript == "Hello from audio"


def test_voice_fallback_router_synthesize(fallback_user):
    """Test POST /api/voice/synthesize router endpoint handler."""
    req = SynthesizeRequest(text="Good morning", voice_name="Aoede")

    with patch("app.routers.voice_fallback.synthesize_text_to_speech", new_callable=AsyncMock) as mock_tts:
        mock_tts.return_value = ("fake_b64_audio", "audio/wav")
        res = asyncio.run(synthesize_speech_endpoint(request=req, current_user=fallback_user))
        assert res.text == "Good morning"
        assert res.audio_base64 == "fake_b64_audio"


def test_voice_fallback_router_query_endpoint(fallback_user):
    """Test POST /api/voice/query router endpoint handler."""
    mock_db = AsyncMock()
    convo_id = uuid.uuid4()
    msg_id = uuid.uuid4()

    mock_pipeline_res = MagicMock()
    mock_pipeline_res.transcript = "What was my first job?"
    mock_pipeline_res.answer = "You started at Tech Corp in 2013."
    mock_pipeline_res.is_grounded = True
    mock_pipeline_res.sources = []
    mock_pipeline_res.audio_base64 = None
    mock_pipeline_res.mime_type = "audio/wav"
    mock_pipeline_res.conversation_id = convo_id
    mock_pipeline_res.message_id = msg_id
    mock_pipeline_res.created_at = datetime.now(timezone.utc)

    with patch("app.routers.voice_fallback.execute_voice_query_pipeline", new_callable=AsyncMock) as mock_pipe:
        mock_pipe.return_value = mock_pipeline_res

        res = asyncio.run(
            voice_query_fallback_endpoint(
                audio=None,
                text="What was my first job?",
                conversation_id=str(convo_id),
                voice_name="Aoede",
                current_user=fallback_user,
                db=mock_db,
            )
        )

        assert res.transcript == "What was my first job?"
        assert res.answer == "You started at Tech Corp in 2013."
        assert res.conversation_id == convo_id

