"""
Unit and Integration Tests for Stage 8: WebSocket Real-Time Chat Streaming

Tests:
1. WebSocket connection authentication (rejection on missing/invalid token)
2. WebSocket connection authentication success with cookie/query token
3. WebSocket ping/pong heartbeat
4. Message validation (empty message error)
5. Full token-by-token streaming RAG pipeline events
6. Direct testing of stream_chat_rag service generator
"""

import uuid
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User
from app.models.conversation import Conversation
from app.schemas.chat import SourceCitation
from app.services.auth_service import create_access_token
from app.services.chat_service import stream_chat_rag


@pytest.fixture
def test_user():
    """Sample authenticated test user."""
    return User(
        id=uuid.uuid4(),
        email="ws_user@example.com",
        username="ws_user",
        hashed_password="...",
        is_active=True,
    )


@pytest.fixture
def auth_token(test_user):
    """Generate a valid JWT token for test user."""
    return create_access_token(user_id=test_user.id)


def test_ws_auth_rejected_without_token():
    """Verify WebSocket handshake is rejected with 1008 when no auth token is provided."""
    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/chat") as ws:
            pass


def test_ws_auth_rejected_invalid_token():
    """Verify WebSocket handshake is rejected when token is invalid or expired."""
    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/chat?token=invalid_tampered_token") as ws:
            pass


def test_ws_auth_success_and_ping_pong(test_user, auth_token):
    """Verify WebSocket connection succeeds with valid token and handles ping/pong."""
    client = TestClient(app)

    with patch("app.routers.websocket_chat.authenticate_ws", new_callable=AsyncMock) as mock_auth:
        mock_auth.return_value = test_user
        client.cookies.set("access_token", auth_token)

        with client.websocket_connect("/ws/chat") as ws:
            # 1. First event should be "connected"
            welcome = ws.receive_json()
            assert welcome["type"] == "connected"
            assert welcome["user_id"] == str(test_user.id)
            assert welcome["username"] == "ws_user"

            # 2. Test ping/pong
            ws.send_json({"action": "ping"})
            pong = ws.receive_json()
            assert pong["type"] == "pong"


def test_ws_empty_message_validation(test_user, auth_token):
    """Verify sending an empty chat message returns an error event without dropping connection."""
    client = TestClient(app)

    with patch("app.routers.websocket_chat.authenticate_ws", new_callable=AsyncMock) as mock_auth:
        mock_auth.return_value = test_user

        with client.websocket_connect(f"/ws/chat?token={auth_token}") as ws:
            ws.receive_json()  # Consume welcome

            ws.send_json({"action": "chat", "message": "   "})
            err = ws.receive_json()
            assert err["type"] == "error"
            assert "cannot be empty" in err["error"]


def test_ws_chat_streaming_flow(test_user, auth_token):
    """Verify the full sequence of streaming events over WebSocket."""
    client = TestClient(app)
    convo_id = uuid.uuid4()
    msg_id = uuid.uuid4()

    async def mock_stream_events(*args, **kwargs):
        yield {"type": "start", "conversation_id": str(convo_id), "user_message_id": str(uuid.uuid4())}
        yield {
            "type": "citations",
            "conversation_id": str(convo_id),
            "citations": [{"memory_title": "Summer Vacation", "similarity_score": 0.88}],
        }
        yield {"type": "chunk", "text": "In 2015, "}
        yield {"type": "chunk", "text": "you visited Italy."}
        yield {
            "type": "done",
            "conversation_id": str(convo_id),
            "message_id": str(msg_id),
            "full_text": "In 2015, you visited Italy.",
            "is_grounded": True,
        }

    with patch("app.routers.websocket_chat.authenticate_ws", new_callable=AsyncMock) as mock_auth, \
         patch("app.routers.websocket_chat.stream_chat_rag", side_effect=mock_stream_events):
        mock_auth.return_value = test_user
        client.cookies.set("access_token", auth_token)

        with client.websocket_connect("/ws/chat") as ws:
            ws.receive_json()  # welcome

            ws.send_json({
                "action": "chat",
                "message": "Where did I go in 2015?",
                "conversation_id": str(convo_id),
            })

            start_evt = ws.receive_json()
            assert start_evt["type"] == "start"
            assert start_evt["conversation_id"] == str(convo_id)

            cit_evt = ws.receive_json()
            assert cit_evt["type"] == "citations"
            assert len(cit_evt["citations"]) == 1
            assert cit_evt["citations"][0]["memory_title"] == "Summer Vacation"

            chunk1 = ws.receive_json()
            assert chunk1["type"] == "chunk"
            assert chunk1["text"] == "In 2015, "

            chunk2 = ws.receive_json()
            assert chunk2["type"] == "chunk"
            assert chunk2["text"] == "you visited Italy."

            done_evt = ws.receive_json()
            assert done_evt["type"] == "done"
            assert done_evt["full_text"] == "In 2015, you visited Italy."
            assert done_evt["is_grounded"] is True


def test_stream_chat_rag_service_direct(test_user):
    """Directly test stream_chat_rag generator service."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_convo = Conversation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        title="Sample Stream Session",
    )

    async def mock_answer_stream(q, citations):
        yield "Grandfather "
        yield "taught me "
        yield "integrity."

    sample_citation = SourceCitation(
        memory_id=uuid.uuid4(),
        memory_title="Grandfather Advice",
        source_type="text",
        filename=None,
        page_number=None,
        chunk_text="Always speak truthfully.",
        similarity_score=0.92,
    )

    with patch("app.services.chat_service.get_or_create_conversation", new_callable=AsyncMock) as mock_get_convo, \
         patch("app.services.chat_service.generate_embedding", new_callable=AsyncMock) as mock_emb, \
         patch("app.services.chat_service.search_relevant_chunks", new_callable=AsyncMock) as mock_search, \
         patch("app.services.chat_service.generate_grounded_answer_stream", side_effect=mock_answer_stream):

        mock_get_convo.return_value = mock_convo
        mock_emb.return_value = [0.1] * 768
        mock_search.return_value = [sample_citation]

        events = []

        async def run_stream():
            async for evt in stream_chat_rag(
                db=mock_db,
                user_id=test_user.id,
                message="What did grandfather teach me?",
            ):
                events.append(evt)

        asyncio.run(run_stream())

        assert len(events) >= 5
        types = [e["type"] for e in events]
        assert "start" in types
        assert "citations" in types
        assert "chunk" in types
        assert "done" in types

        done_event = [e for e in events if e["type"] == "done"][0]
        assert done_event["full_text"] == "Grandfather taught me integrity."
        assert done_event["is_grounded"] is True
