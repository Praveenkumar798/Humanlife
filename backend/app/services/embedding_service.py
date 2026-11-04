"""
Human Legacy AI - Gemini Embedding Service

Generates dense vector embeddings using Google Gemini API (`text-embedding-004`).
All Gemini operations execute strictly on the backend.
"""

from typing import List, Optional
from google import genai
from fastapi import HTTPException, status
from app.config import settings


def get_gemini_client() -> genai.Client:
    """
    Instantiate a Gemini API client using the configured backend API key.
    Raises 503 Service Unavailable if GEMINI_API_KEY is not configured.
    """
    if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Gemini API key is not configured. Please set GEMINI_API_KEY "
                "in your backend .env file. Create your key at https://aistudio.google.com/"
            ),
        )
    return genai.Client(api_key=settings.GEMINI_API_KEY.strip())


async def generate_embedding(text: str) -> List[float]:
    """
    Generate a 768-dimensional vector embedding for a single text chunk or user query.
    """
    client = get_gemini_client()
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Cannot generate embedding for empty text.")

    try:
        response = client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=clean_text,
        )

        if not response.embeddings or len(response.embeddings) == 0:
            raise RuntimeError("Gemini API returned an empty embedding response.")

        embedding_values = response.embeddings[0].values
        return embedding_values

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate embedding with Gemini API: {str(e)}",
        )


async def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate vector embeddings for a list of text chunks.
    Processes items sequentially or in batches according to API limits.
    """
    if not texts:
        return []

    client = get_gemini_client()
    embeddings_list: List[List[float]] = []

    try:
        # Generate embeddings for each text
        for t in texts:
            clean = t.strip()
            if not clean:
                continue
            res = client.models.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                contents=clean,
            )
            if res.embeddings and len(res.embeddings) > 0:
                embeddings_list.append(res.embeddings[0].values)
            else:
                raise RuntimeError("Empty embedding returned by Gemini.")

        return embeddings_list

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Batch embedding generation failed: {str(e)}",
        )

