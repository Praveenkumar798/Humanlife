"""
Human Legacy AI - Gemini Live Voice Service

Manages bidirectional real-time audio streaming with Google Gemini Live Multimodal API
(gemini-2.0-flash-live-001). Connects browser microphone PCM audio to Gemini Live
and returns synthesized audio tokens back to the user with memory grounding.
"""

import base64
import json
import uuid
import asyncio
from typing import Optional, List
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select, desc
from google.genai import types

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.memory import Memory
from app.services.embedding_service import get_gemini_client

FALLBACK_VOICE_MESSAGE = (
    "Live voice connection is currently unavailable. "
    "Please check that your Gemini API key has access to the Live API."
)


async def get_user_memory_context(user_id: uuid.UUID, limit: int = 15) -> str:
    """
    Load user's most important memories from database to form a concise
    grounding system instruction for the Gemini Live session.
    """
    try:
        async with AsyncSessionLocal() as db:
            stmt = (
                select(Memory)
                .where(Memory.user_id == user_id)
                .order_by(desc(Memory.importance), desc(Memory.created_at))
                .limit(limit)
            )
            result = await db.execute(stmt)
            memories = result.scalars().all()
    except Exception as e:
        print(f"⚠️ Warning: Failed to load user memories for voice context: {e}")
        memories = []

    context_lines = []
    for m in memories:
        snippet = m.content[:300].strip().replace("\n", " ")
        context_lines.append(f"- [{m.category or 'Memory'}] {m.title}: {snippet}")

    memories_text = (
        "\n".join(context_lines)
        if context_lines
        else "No specific personal memories recorded yet."
    )

    system_instruction = f"""You are the voice memory replica of a real person in the Human Legacy AI preservation system.
You speak directly with the user or their loved ones in a warm, reflective, conversational voice.

CRITICAL RULES:
1. Speak in first person ('I', 'my', 'we').
2. Base personal stories, choices, principles, and dates strictly on the documented memories below.
3. If asked about personal life events or details that are NOT in your documented memories, respond honestly:
"I don't have enough information in my stored memories about that."
4. Do NOT fabricate or extrapolate personal facts, dates, or stories.
5. Keep conversational responses concise, natural, and friendly for spoken audio.

DOCUMENTED PERSONAL MEMORIES:
{memories_text}
"""
    return system_instruction


def create_live_connect_config(system_instruction: str) -> types.LiveConnectConfig:
    """Construct configuration for Gemini Live API bidirectional session."""
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Aoede"  # Natural warm voice
                )
            )
        ),
        system_instruction=types.Content(
            parts=[types.Part(text=system_instruction)]
        ),
    )


async def run_live_voice_stream(
    websocket: WebSocket,
    user_id: uuid.UUID,
):
    """
    Run bidirectional streaming between user WebSocket and Gemini Live API:
    1. Browser mic -> 16kHz PCM audio -> Gemini Live
    2. Gemini Live -> 24kHz PCM audio -> Browser playback
    """
    # 1. Prepare grounding context
    context = await get_user_memory_context(user_id=user_id)
    config = create_live_connect_config(system_instruction=context)

    client = get_gemini_client()

    try:
        # Establish Live API session
        async with client.aio.live.connect(
            model=settings.GEMINI_LIVE_MODEL,
            config=config,
        ) as live_session:

            await websocket.send_json({
                "type": "live_ready",
                "message": "Gemini Live session connected. Listening for your voice.",
            })

            # Task A: Forward incoming browser audio to Gemini Live
            async def forward_client_to_gemini():
                try:
                    while True:
                        msg = await websocket.receive()
                        if "bytes" in msg and msg["bytes"]:
                            # Raw binary PCM chunk (16kHz 16-bit Mono)
                            pcm_data = msg["bytes"]
                            await live_session.send_realtime_input(
                                audio=types.Blob(
                                    data=pcm_data,
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )
                        elif "text" in msg and msg["text"]:
                            data = json.loads(msg["text"])
                            action = data.get("action") or data.get("type")

                            if action == "ping":
                                await websocket.send_json({"type": "pong"})
                                continue

                            if action == "audio" and data.get("data"):
                                pcm_bytes = base64.b64decode(data["data"])
                                await live_session.send_realtime_input(
                                    audio=types.Blob(
                                        data=pcm_bytes,
                                        mime_type="audio/pcm;rate=16000",
                                    )
                                )
                            elif action == "text" and data.get("text"):
                                await live_session.send_realtime_input(text=data["text"])
                except WebSocketDisconnect:
                    pass
                except Exception as e:
                    print(f"Client to Gemini stream ended: {e}")

            # Task B: Forward Gemini Live audio responses to browser
            async def forward_gemini_to_client():
                try:
                    async for server_msg in live_session.receive():
                        content = getattr(server_msg, "server_content", None)
                        if not content:
                            continue

                        model_turn = getattr(content, "model_turn", None)
                        if model_turn and hasattr(model_turn, "parts"):
                            for part in model_turn.parts:
                                # Audio output
                                inline = getattr(part, "inline_data", None)
                                if inline and hasattr(inline, "data") and inline.data:
                                    audio_b64 = base64.b64encode(inline.data).decode("utf-8")
                                    await websocket.send_json({
                                        "type": "audio",
                                        "data": audio_b64,
                                        "mime_type": getattr(inline, "mime_type", "audio/pcm;rate=24000"),
                                    })

                                # Text transcript output if available
                                txt = getattr(part, "text", None)
                                if txt:
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "text": txt,
                                    })

                        if getattr(content, "turn_complete", False):
                            await websocket.send_json({"type": "turn_complete"})

                except Exception as e:
                    print(f"Gemini to Client stream ended: {e}")

            # Run both streaming directions concurrently
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(forward_client_to_gemini()),
                    asyncio.create_task(forward_gemini_to_client()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()

    except Exception as e:
        # Graceful fallback notification for Stage 10
        print(f"⚠️ Gemini Live error: {e}")
        try:
            await websocket.send_json({
                "type": "fallback_needed",
                "reason": str(e),
                "message": FALLBACK_VOICE_MESSAGE,
            })
        except Exception:
            pass
