"""
Human Legacy AI - Voice Fallback Service

Implements the Stage 10 fallback voice pipeline:
1. Speech-to-Text (STT) transcription of audio via Gemini Multimodal API.
2. Evidence-grounded memory retrieval via RAG engine.
3. Text-to-Speech (TTS) audio synthesis via Gemini with graceful browser speech fallback.
"""

import base64
import uuid
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from google.genai import types

from app.config import settings
from app.schemas.chat import ChatRequest
from app.schemas.voice import VoiceQueryResponse
from app.services.embedding_service import get_gemini_client
from app.services.chat_service import process_chat_message


async def transcribe_audio_bytes(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    Transcribe spoken audio bytes to text using Gemini Multimodal understanding.
    Supports audio/wav, audio/mp3, audio/webm, audio/ogg, audio/pcm.
    """
    if not audio_bytes or len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transcribe empty audio file.",
        )

    client = get_gemini_client()
    clean_mime = mime_type.split(";")[0].strip() if mime_type else "audio/webm"

    prompt = (
        "You are an expert multilingual audio transcription engine. "
        "Listen to the following spoken audio clip and output verbatim what the speaker said. "
        "The speaker may be speaking in Telugu, Hindi, English, or a mix of these languages. "
        "Accurately transcribe in the exact spoken language. "
        "Do NOT add introductory text, conversational replies, or quotation marks. "
        "Output ONLY the transcribed words."
    )

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_LLM_MODEL,
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=clean_mime),
                prompt,
            ],
        )

        transcript = response.text.strip() if response and response.text else ""
        return transcript

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech-to-Text transcription failed: {str(e)}",
        )


async def synthesize_text_to_speech(
    text: str,
    voice_name: str = "Aoede"
) -> Tuple[Optional[str], str]:
    """
    Synthesize text into speech audio bytes using Gemini audio response modality.
    Returns: (base64_audio_or_none, mime_type)
    If server-side audio synthesis is unsupported by the model or key,
    returns (None, mime_type) so frontend can use browser SpeechSynthesis API.
    """
    clean_text = text.strip()
    if not clean_text:
        return None, "audio/wav"

    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model=settings.GEMINI_LLM_MODEL,
            contents=(
                f"Read this aloud in an authentic, warm, natural speaking voice with fluent pronunciation "
                f"for the language used (Telugu, Hindi, or English): {clean_text}"
            ),
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name or "Aoede"
                        )
                    )
                ),
            ),
        )

        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                inline = getattr(part, "inline_data", None)
                if inline and getattr(inline, "data", None):
                    b64 = base64.b64encode(inline.data).decode("utf-8")
                    mime = getattr(inline, "mime_type", "audio/wav") or "audio/wav"
                    return b64, mime

        return None, "audio/wav"

    except Exception as e:
        print(f"⚠️ Server TTS synthesis notice (will use browser TTS fallback): {e}")
        return None, "audio/wav"


async def execute_voice_query_pipeline(
    db: AsyncSession,
    user_id: uuid.UUID,
    audio_bytes: Optional[bytes] = None,
    mime_type: str = "audio/webm",
    text_query: Optional[str] = None,
    conversation_id: Optional[uuid.UUID] = None,
    voice_name: str = "Aoede",
) -> VoiceQueryResponse:
    """
    Complete end-to-end Fallback Voice Pipeline:
    1. STT: Transcribe audio input (or use provided text query).
    2. RAG: Run semantic search over stored pgvector memories and generate grounded answer.
    3. TTS: Synthesize speech audio.
    4. Return full response with citations and audio.
    """
    # 1. Transcribe or use provided text
    if audio_bytes:
        transcript = await transcribe_audio_bytes(audio_bytes=audio_bytes, mime_type=mime_type)
    else:
        transcript = (text_query or "").strip()

    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No spoken words or question could be recognized from the input.",
        )

    # 2. Execute RAG chat message flow
    chat_req = ChatRequest(
        message=transcript,
        conversation_id=conversation_id,
    )
    chat_resp = await process_chat_message(
        db=db,
        user_id=user_id,
        request=chat_req,
    )

    # 3. Synthesize speech for the answer
    audio_b64, audio_mime = await synthesize_text_to_speech(
        text=chat_resp.answer,
        voice_name=voice_name,
    )

    return VoiceQueryResponse(
        transcript=transcript,
        answer=chat_resp.answer,
        sources=chat_resp.sources,
        is_grounded=chat_resp.is_grounded,
        audio_base64=audio_b64,
        mime_type=audio_mime,
        conversation_id=chat_resp.conversation_id,
        message_id=chat_resp.message_id,
        created_at=chat_resp.created_at,
    )

