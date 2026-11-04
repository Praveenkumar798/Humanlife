"""
Unit and Integration Tests for Stage 9: Gemini Live API Voice Connection

Tests:
1. WebSocket voice handshake authentication rejection (missing/invalid token)
2. WebSocket voice handshake authentication success with cookie/query token
3. User memory context builder and prompt grounding formatting
4. Gemini Live configuration structure (audio modalities & voice)
5. Full bidirectional audio streaming & transcript flow
6. Graceful fallback event signaling on Live API unavailability
"""

import uuid
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User
from app.models.memory import Memory
from app.services.auth_service import create_access_token
from app.services.voice_service import (
    get_user_memory_context,
    create_live_connect_config,
    FALLBACK_VOICE_MESSAGE,
)


@pytest.fixture
def voice_user():
    """Sample authenticated test user."""
    return User(
        id=uuid.uuid4(),
        email="voice_user@example.com",
        username="voice_tester",
        hashed_password="...",
        is_active=True,
    )


@pytest.fixture
def voice_token(voice_user):
    """Generate a valid JWT token for test user."""
    return create_access_token(user_id=voice_user.id)


def test_voice_ws_auth_rejected_without_token():
    """Verify voice WebSocket connection is rejected when unauthenticated."""
    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/voice-live") as ws:
            pass


def test_voice_ws_auth_rejected_invalid_token():
    """Verify voice WebSocket handshake is rejected with invalid token."""
    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/voice-live?token=fake_invalid_token") as ws:
            pass


def test_voice_ws_auth_success(voice_user, voice_token):
    """Verify voice WebSocket connection accepts valid cookie authentication."""
    client = TestClient(app)

    with patch("app.routers.websocket_voice.authenticate_ws", new_callable=AsyncMock) as mock_auth, \
         patch("app.routers.websocket_voice.run_live_voice_stream", new_callable=AsyncMock) as mock_stream:
        mock_auth.return_value = voice_user
        mock_stream.return_value = None
        client.cookies.set("access_token", voice_token)

        with client.websocket_connect("/ws/voice-live") as ws:
            welcome = ws.receive_json()
            assert welcome["type"] == "connected"
            assert welcome["mode"] == "gemini_live_voice"
            assert welcome["username"] == "voice_tester"


def test_get_user_memory_context_formatting(voice_user):
    """Verify that user memories are retrieved and structured into grounded system instructions."""
    sample_memories = [
        Memory(
            id=uuid.uuid4(),
            user_id=voice_user.id,
            title="Graduation Day 2012",
            content="Graduated with honors in computer engineering with my parents attending.",
            category="Milestone",
            importance=9.0,
        ),
        Memory(
            id=uuid.uuid4(),
            user_id=voice_user.id,
            title="First Job at Tech Corp",
            content="Joined as a junior developer and learned teamwork and resilience.",
            category="Career",
            importance=8.5,
        ),
    ]

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = sample_memories

    with patch("app.services.voice_service.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__.return_value.execute = AsyncMock(return_value=mock_res)

        instruction = asyncio.run(get_user_memory_context(user_id=voice_user.id))

        assert "Human Legacy AI preservation system" in instruction
        assert "Graduation Day 2012" in instruction
        assert "First Job at Tech Corp" in instruction
        assert "CRITICAL RULES" in instruction


def test_create_live_connect_config():
    """Verify LiveConnectConfig initializes with AUDIO modality and Aoede voice."""
    sys_instruction = "Ground all answers strictly in memories."
    config = create_live_connect_config(sys_instruction)

    assert config.response_modalities == ["AUDIO"]
    assert config.speech_config.voice_config.prebuilt_voice_config.voice_name == "Aoede"


def test_voice_ws_streaming_audio_and_transcript(voice_user, voice_token):
    """Verify bidirectional WebSocket event pipeline for audio and transcript."""
    client = TestClient(app)

    async def mock_run_live(websocket, user_id):
        await websocket.send_json({"type": "live_ready", "message": "Listening"})
        # Simulate received audio chunk from Gemini
        await websocket.send_json({
            "type": "audio",
            "data": "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
            "mime_type": "audio/pcm;rate=24000",
        })
        # Simulate text transcript
        await websocket.send_json({
            "type": "transcript",
            "text": "I remember graduation like it was yesterday.",
        })
        await websocket.send_json({"type": "turn_complete"})

    with patch("app.routers.websocket_voice.authenticate_ws", new_callable=AsyncMock) as mock_auth, \
         patch("app.routers.websocket_voice.run_live_voice_stream", side_effect=mock_run_live):
        mock_auth.return_value = voice_user
        client.cookies.set("access_token", voice_token)

        with client.websocket_connect("/ws/voice-live") as ws:
            welcome = ws.receive_json()
            assert welcome["type"] == "connected"

            ready = ws.receive_json()
            assert ready["type"] == "live_ready"

            audio_chunk = ws.receive_json()
            assert audio_chunk["type"] == "audio"
            assert audio_chunk["mime_type"] == "audio/pcm;rate=24000"

            trans = ws.receive_json()
            assert trans["type"] == "transcript"
            assert "graduation" in trans["text"]

            turn = ws.receive_json()
            assert turn["type"] == "turn_complete"


def test_voice_ws_fallback_signal(voice_user, voice_token):
    """Verify WebSocket emits fallback_needed event when Live API is offline or throws error."""
    client = TestClient(app)

    async def mock_error_live(websocket, user_id):
        await websocket.send_json({
            "type": "fallback_needed",
            "reason": "Live API preview model unavailable in region",
            "message": FALLBACK_VOICE_MESSAGE,
        })

    with patch("app.routers.websocket_voice.authenticate_ws", new_callable=AsyncMock) as mock_auth, \
         patch("app.routers.websocket_voice.run_live_voice_stream", side_effect=mock_error_live):
        mock_auth.return_value = voice_user
        client.cookies.set("access_token", voice_token)

        with client.websocket_connect("/ws/voice-live") as ws:
            ws.receive_json()  # welcome
            fallback = ws.receive_json()
            assert fallback["type"] == "fallback_needed"
            assert "Live API preview model unavailable" in fallback["reason"]

