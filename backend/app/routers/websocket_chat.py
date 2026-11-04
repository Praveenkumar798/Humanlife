"""
Human Legacy AI - WebSocket Chat Router

Provides real-time token streaming for AI replica conversations via WebSockets.
Authenticates via httpOnly cookie or query token parameter.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.services.chat_service import stream_chat_rag

router = APIRouter(tags=["WebSocket Chat"])


async def authenticate_ws(websocket: WebSocket) -> Optional[User]:
    """
    Authenticate incoming WebSocket connection using httpOnly cookie or query token.
    Returns User if valid and active, else None.
    """
    # 1. Cookie-based auth (default in web browsers)
    token = websocket.cookies.get("access_token")

    # 2. Query param fallback (?token=...)
    if not token:
        token = websocket.query_params.get("token")

    if not token:
        return None

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        return None

    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            return None
        return user


@router.websocket("/ws/chat")
async def websocket_chat_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time token-by-token chat streaming.

    Accepts JSON messages:
      {
        "action": "chat",
        "message": "What did I learn from grandfather?",
        "conversation_id": "optional-uuid",
        "top_k": 5,
        "similarity_threshold": 0.5
      }

    Streams events:
      - {"type": "connected", "user_id": "...", "username": "..."}
      - {"type": "start", "conversation_id": "...", "user_message_id": "..."}
      - {"type": "citations", "conversation_id": "...", "citations": [...]}
      - {"type": "chunk", "text": "..."}
      - {"type": "done", "conversation_id": "...", "message_id": "...", "full_text": "...", "is_grounded": true}
      - {"type": "error", "error": "..."}
    """
    user = await authenticate_ws(websocket)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    await websocket.accept()
    await websocket.send_json({
        "type": "connected",
        "message": "Connected to Human Legacy AI Chat Stream",
        "user_id": str(user.id),
        "username": user.username,
    })

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action", "chat")

            if action == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            message = (data.get("message") or "").strip()
            if not message:
                await websocket.send_json({"type": "error", "error": "Message cannot be empty."})
                continue

            convo_id_str = data.get("conversation_id")
            conversation_id = None
            if convo_id_str:
                try:
                    conversation_id = uuid.UUID(convo_id_str)
                except (ValueError, TypeError):
                    pass

            top_k = data.get("top_k")
            similarity_threshold = data.get("similarity_threshold")

            # Stream response events
            async with AsyncSessionLocal() as db:
                async for event in stream_chat_rag(
                    db=db,
                    user_id=user.id,
                    message=message,
                    conversation_id=conversation_id,
                    top_k=top_k,
                    similarity_threshold=similarity_threshold,
                ):
                    await websocket.send_json(event)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "error": f"Server processing error: {str(e)}",
            })
        except Exception:
            pass

