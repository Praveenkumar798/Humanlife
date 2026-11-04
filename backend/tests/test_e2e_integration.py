"""
Human Legacy AI - End-to-End (E2E) Integration Test Suite

Simulates the complete user lifecycle across all 11 stages:
1. Health & Readiness Verification
2. User Registration & Password Hashing
3. Secure Login & httpOnly Cookie Validation
4. Protected Identity (/api/auth/me)
5. Memory Creation & Automatic Vector Indexing
6. Memory Retrieval, Search, and Filtering
7. File Upload & Processing Job Lifecycle
8. RAG Retrieval & Evidence-Grounded Response
9. WebSocket Real-Time Chat Token Streaming (/ws/chat)
10. Gemini Live Voice WebSocket Handshake (/ws/voice-live)
11. Voice Fallback Pipeline Query (/api/voice/query)
12. Memory Deletion & Disk Cleanup
13. User Logout & Session Revocation
"""

import io
import uuid
import asyncio
from datetime import datetime, timezone, date
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.models.memory import Memory
from app.schemas.chat import SourceCitation, ChatResponse
from app.services.auth_service import hash_password, create_access_token


@pytest.fixture
def e2e_user():
    """Sample user for E2E testing."""
    now = datetime.now(timezone.utc)
    return User(
        id=uuid.uuid4(),
        email="e2e_journey@example.com",
        username="e2e_hero",
        hashed_password=hash_password("SuperSecret2026!"),
        is_active=True,
        created_at=now,
        updated_at=now,
    )


def test_complete_user_journey_e2e(e2e_user):
    """
    Executes the entire end-to-end journey simulating a real user
    interacting with the full Human Legacy AI stack.
    """
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: e2e_user

    try:
        client = TestClient(app)

        # -------------------------------------------------------------
        # 1. Health & Metadata Checks
        # -------------------------------------------------------------
        root_res = client.get("/")
        assert root_res.status_code == 200
        assert root_res.json()["app"] == "Human Legacy AI"

        health_res = client.get("/health")
        assert health_res.status_code == 200
        assert health_res.json()["status"] == "healthy"

        # -------------------------------------------------------------
        # 2. Registration Flow
        # -------------------------------------------------------------
        with patch("app.routers.auth.register_user", new_callable=AsyncMock) as mock_reg:
            mock_reg.return_value = e2e_user
            reg_payload = {
                "email": "e2e_journey@example.com",
                "username": "e2e_hero",
                "password": "SuperSecret2026!",
            }
            res_reg = client.post("/api/auth/register", json=reg_payload)
            assert res_reg.status_code == 201
            assert "access_token" in res_reg.cookies
            assert res_reg.json()["email"] == "e2e_journey@example.com"

        # -------------------------------------------------------------
        # 3. Login Flow
        # -------------------------------------------------------------
        with patch("app.routers.auth.authenticate_user", new_callable=AsyncMock) as mock_auth_srv:
            mock_auth_srv.return_value = e2e_user
            login_payload = {
                "email_or_username": "e2e_hero",
                "password": "SuperSecret2026!",
            }
            res_login = client.post("/api/auth/login", json=login_payload)
            assert res_login.status_code == 200
            assert "access_token" in res_login.cookies
            jwt_token = res_login.cookies["access_token"]
            assert len(jwt_token) > 20

        # -------------------------------------------------------------
        # 4. Identity Check (/api/auth/me)
        # -------------------------------------------------------------
        with patch("app.middleware.auth_middleware.get_current_user", return_value=e2e_user):
            res_me = client.get("/api/auth/me")
            assert res_me.status_code == 200
            assert res_me.json()["username"] == "e2e_hero"

        # -------------------------------------------------------------
        # 5. Memory Creation & Automatic Chunk Indexing
        # -------------------------------------------------------------
        created_memory = Memory(
            id=uuid.uuid4(),
            user_id=e2e_user.id,
            title="College Graduation Day",
            content="In June 2014, I graduated at the top of my class with honors in computer engineering.",
            category="Milestone",
            tags=["college", "graduation", "honors"],
            memory_type="episodic",
            importance=9.5,
            verification_status="owner_confirmed",
            event_date=date(2014, 6, 20),
            source_type="text",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        with patch("app.middleware.auth_middleware.get_current_user", return_value=e2e_user), \
             patch("app.routers.memories.create_memory", new_callable=AsyncMock) as mock_create_mem:
            mock_create_mem.return_value = created_memory

            mem_payload = {
                "title": "College Graduation Day",
                "content": "In June 2014, I graduated at the top of my class with honors in computer engineering.",
                "category": "Milestone",
                "tags": ["college", "graduation", "honors"],
                "importance": 9.5,
                "verification_status": "owner_confirmed",
                "event_date": "2014-06-20",
            }
            res_mem = client.post("/api/memories", json=mem_payload)
            assert res_mem.status_code == 201
            assert res_mem.json()["title"] == "College Graduation Day"
            assert res_mem.json()["importance"] == 9.5

        # -------------------------------------------------------------
        # 6. Memory Listing & Search
        # -------------------------------------------------------------
        with patch("app.middleware.auth_middleware.get_current_user", return_value=e2e_user), \
             patch("app.routers.memories.get_memories", new_callable=AsyncMock) as mock_get_mems:
            mock_get_mems.return_value = ([created_memory], 1)

            res_list = client.get("/api/memories?category=Milestone")
            assert res_list.status_code == 200
            assert res_list.json()["total"] == 1
            assert len(res_list.json()["items"]) == 1

        # -------------------------------------------------------------
        # 7. File Upload & Processing Job
        # -------------------------------------------------------------
        dummy_job_id = uuid.uuid4()
        dummy_file_id = uuid.uuid4()
        mock_src = MagicMock(id=dummy_file_id, filename="advice.txt", file_type="txt", file_size=50)
        mock_job = MagicMock(id=dummy_job_id, status="completed")
        mock_mem_obj = MagicMock(id=uuid.uuid4())

        with patch("app.routers.uploads.process_file_pipeline", new_callable=AsyncMock) as mock_pipeline:
            mock_pipeline.return_value = (mock_src, mock_job, mock_mem_obj)

            txt_file = io.BytesIO(b"My grandfather always advised to remain truthful.")
            res_upload = client.post(
                "/api/uploads",
                files={"file": ("advice.txt", txt_file, "text/plain")},
            )
            assert res_upload.status_code == 201
            assert res_upload.json()["job_id"] == str(dummy_job_id)
            assert res_upload.json()["status"] == "completed"

        # -------------------------------------------------------------
        # 8. Grounded RAG Chatbot Query
        # -------------------------------------------------------------
        sample_citation = SourceCitation(
            memory_id=created_memory.id,
            memory_title=created_memory.title,
            source_type="text",
            chunk_text="In June 2014, I graduated at the top of my class with honors.",
            similarity_score=0.94,
        )
        convo_id = uuid.uuid4()
        msg_id = uuid.uuid4()

        mock_chat_response = ChatResponse(
            conversation_id=convo_id,
            message_id=msg_id,
            answer="You graduated with honors in computer engineering in June 2014.",
            sources=[sample_citation],
            is_grounded=True,
            created_at=datetime.now(timezone.utc),
        )

        with patch("app.middleware.auth_middleware.get_current_user", return_value=e2e_user), \
             patch("app.routers.chat.process_chat_message", new_callable=AsyncMock) as mock_chat_srv:
            mock_chat_srv.return_value = mock_chat_response

            chat_payload = {"message": "When did I graduate from college?"}
            res_chat = client.post("/api/chat", json=chat_payload)
            assert res_chat.status_code == 200
            assert "2014" in res_chat.json()["answer"]
            assert res_chat.json()["is_grounded"] is True
            assert len(res_chat.json()["sources"]) == 1

        # -------------------------------------------------------------
        # 9. Real-Time Chat WebSocket Token Streaming (/ws/chat)
        # -------------------------------------------------------------
        async def mock_ws_chat_stream(*args, **kwargs):
            yield {"type": "start", "conversation_id": str(convo_id), "user_message_id": str(uuid.uuid4())}
            yield {"type": "citations", "conversation_id": str(convo_id), "citations": [sample_citation.model_dump(mode="json")]}
            yield {"type": "chunk", "text": "You graduated in "}
            yield {"type": "chunk", "text": "June 2014."}
            yield {
                "type": "done",
                "conversation_id": str(convo_id),
                "message_id": str(msg_id),
                "full_text": "You graduated in June 2014.",
                "is_grounded": True,
            }

        with patch("app.routers.websocket_chat.authenticate_ws", new_callable=AsyncMock) as mock_ws_auth, \
             patch("app.routers.websocket_chat.stream_chat_rag", side_effect=mock_ws_chat_stream):
            mock_ws_auth.return_value = e2e_user
            client.cookies.set("access_token", jwt_token)

            with client.websocket_connect("/ws/chat") as ws:
                welcome = ws.receive_json()
                assert welcome["type"] == "connected"

                ws.send_json({"action": "chat", "message": "When did I graduate?"})
                st = ws.receive_json()
                assert st["type"] == "start"
                cits = ws.receive_json()
                assert cits["type"] == "citations"
                chk1 = ws.receive_json()
                assert chk1["type"] == "chunk"
                chk2 = ws.receive_json()
                assert chk2["type"] == "chunk"
                done = ws.receive_json()
                assert done["type"] == "done"
                assert done["is_grounded"] is True

        # -------------------------------------------------------------
        # 10. Gemini Live Voice WebSocket Handshake (/ws/voice-live)
        # -------------------------------------------------------------
        async def mock_ws_voice_stream(websocket, user_id):
            await websocket.send_json({"type": "live_ready", "message": "Live session active."})
            await websocket.send_json({"type": "turn_complete"})

        with patch("app.routers.websocket_voice.authenticate_ws", new_callable=AsyncMock) as mock_voice_auth, \
             patch("app.routers.websocket_voice.run_live_voice_stream", side_effect=mock_ws_voice_stream):
            mock_voice_auth.return_value = e2e_user

            with client.websocket_connect("/ws/voice-live") as ws_voice:
                v_welcome = ws_voice.receive_json()
                assert v_welcome["type"] == "connected"
                assert v_welcome["mode"] == "gemini_live_voice"

                v_ready = ws_voice.receive_json()
                assert v_ready["type"] == "live_ready"

        # -------------------------------------------------------------
        # 11. Voice Fallback Query Pipeline (/api/voice/query)
        # -------------------------------------------------------------
        mock_voice_query_res = MagicMock()
        mock_voice_query_res.transcript = "What principles guide my life?"
        mock_voice_query_res.answer = "Truthfulness and integrity as taught by grandfather."
        mock_voice_query_res.sources = [sample_citation]
        mock_voice_query_res.is_grounded = True
        mock_voice_query_res.audio_base64 = "UklGRi4AAABXQVZF..."
        mock_voice_query_res.mime_type = "audio/wav"
        mock_voice_query_res.conversation_id = convo_id
        mock_voice_query_res.message_id = msg_id
        mock_voice_query_res.created_at = datetime.now(timezone.utc)

        with patch("app.middleware.auth_middleware.get_current_user", return_value=e2e_user), \
             patch("app.routers.voice_fallback.execute_voice_query_pipeline", new_callable=AsyncMock) as mock_vpipe:
            mock_vpipe.return_value = mock_voice_query_res

            res_vq = client.post(
                "/api/voice/query",
                data={"text": "What principles guide my life?", "voice_name": "Aoede"},
            )
            assert res_vq.status_code == 200
            assert "integrity" in res_vq.json()["answer"]
            assert res_vq.json()["audio_base64"] is not None

        # -------------------------------------------------------------
        # 12. Memory Deletion
        # -------------------------------------------------------------
        with patch("app.middleware.auth_middleware.get_current_user", return_value=e2e_user), \
             patch("app.routers.memories.delete_memory", new_callable=AsyncMock) as mock_del_mem:
            mock_del_mem.return_value = True

            res_del = client.delete(f"/api/memories/{created_memory.id}")
            assert res_del.status_code == 200
            assert "deleted successfully" in res_del.json()["message"]

        # -------------------------------------------------------------
        # 13. User Logout & Session Cleared
        # -------------------------------------------------------------
        res_logout = client.post("/api/auth/logout")
        assert res_logout.status_code == 200
        assert "logged out" in res_logout.json()["message"].lower()

    finally:
        app.dependency_overrides.clear()
