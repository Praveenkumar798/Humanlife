"""
Human Legacy AI - Gemini Live Voice WebSocket Router

Provides bidirectional multimodal voice streaming via WebSocket endpoint:
/ws/voice-live
Authenticates via httpOnly cookie or query token parameter.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.routers.websocket_chat import authenticate_ws
from app.services.voice_service import run_live_voice_stream

router = APIRouter(tags=["WebSocket Voice"])


@router.websocket("/ws/voice-live")
async def websocket_voice_live_endpoint(websocket: WebSocket):
    """
    Bidirectional WebSocket connection for Gemini Live voice conversation.

    Protocol:
    - Client sends binary PCM audio chunks (16kHz 16-bit Mono) or JSON { "type": "audio", "data": base64 }
    - Server sends JSON:
        - { "type": "connected", "mode": "gemini_live_voice" }
        - { "type": "live_ready" }
        - { "type": "audio", "data": base64_pcm, "mime_type": "audio/pcm;rate=24000" }
        - { "type": "transcript", "text": "..." }
        - { "type": "turn_complete" }
        - { "type": "fallback_needed", "reason": "..." }
    """
    user = await authenticate_ws(websocket)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    await websocket.accept()
    await websocket.send_json({
        "type": "connected",
        "mode": "gemini_live_voice",
        "user_id": str(user.id),
        "username": user.username,
    })

    try:
        await run_live_voice_stream(websocket=websocket, user_id=user.id)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "error",
                "error": f"Voice session terminated: {str(e)}",
            })
        except Exception:
            pass

