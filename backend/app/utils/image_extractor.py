"""
Human Legacy AI - Multimodal Image & Handwritten Document Extractor

Leverages Gemini Vision to inspect vintage photographs, handwriting, letters,
and diary pages. Generates high-accuracy OCR transcription and evocative
biographical narratives.
"""

import os
import re
import json
from typing import Dict, Any, Optional
from google.genai import types
from app.config import settings
from app.services.embedding_service import get_gemini_client


IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _extract_json(raw_text: str) -> Dict[str, Any]:
    """Extract and parse JSON object from LLM response text."""
    clean = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
    if match:
        clean = match.group(1).strip()

    try:
        return json.loads(clean)
    except Exception:
        first_brace = clean.find("{")
        last_brace = clean.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            return json.loads(clean[first_brace : last_brace + 1])
        raise ValueError(f"Could not parse valid JSON from vision response: {raw_text[:200]}")


def extract_image_multimodal(
    image_path: str,
    user_context: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extract biographical story and handwriting OCR from an image file using Gemini Vision.
    Falls back to a resilient heuristic draft when Gemini is unavailable.
    """
    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"Image file not found at: {image_path}")

    filename = os.path.basename(image_path)
    _, ext = os.path.splitext(filename)
    mime_type = IMAGE_MIME_TYPES.get(ext.lower(), "image/jpeg")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    # If Gemini API key is configured, call Gemini Vision
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
        try:
            client = get_gemini_client()
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

            context_clause = f'User background note about this image: "{user_context}"' if user_context else "No user note provided."

            prompt = f"""You are an expert archivist, oral historian, and biographer analyzing an uploaded personal photograph, handwritten diary entry, certificate, or historical document.
{context_clause}

Your task:
1. If this contains handwriting or text (e.g. diary entry, letter, postcard, certificate):
   - Perform precise OCR transcription of the handwritten or printed text.
2. If this is a photograph or portrait:
   - Identify the people, setting, clothing style, approximate vintage era/decade, emotional atmosphere, and historical significance.
3. Combine the visual analysis and transcription into a coherent, evocative biographical narrative written in clear prose.
4. Extract structured metadata:
   - title (poignant 3-7 word chapter title)
   - narrative (the full combined story: description + meaning + transcribed words)
   - transcription (any text transcribed, or null if pure photograph)
   - category (e.g. "Family & Roots", "Personal Reflection", "Turning Point", "Letters & Diary", "Milestone")
   - approximate_date (YYYY-MM-DD or year if detectable or mentioned in note, else null)
   - importance (1.0 to 10.0 scale)
   - tags (3 to 6 descriptive tags)

Respond STRICTLY with a valid JSON object matching this schema:
{{
  "title": "Title Here",
  "narrative": "Detailed narrative story combining visual details and personal meaning...",
  "transcription": "Exact transcribed text or null",
  "category": "Family & Roots",
  "approximate_date": "1982-05-14",
  "importance": 9.0,
  "tags": ["vintage", "wedding", "family", "1980s"]
}}

Return ONLY the raw JSON object, without markdown formatting or greetings."""

            response = client.models.generate_content(
                model=settings.GEMINI_LLM_MODEL,
                contents=[image_part, prompt],
            )

            if response and response.text:
                data = _extract_json(response.text)
                return {
                    "title": str(data.get("title") or os.path.splitext(filename)[0]),
                    "narrative": str(data.get("narrative") or "Photographic record preserved in vault."),
                    "transcription": data.get("transcription"),
                    "category": str(data.get("category") or "Personal Reflection"),
                    "approximate_date": data.get("approximate_date"),
                    "importance": float(data.get("importance") or 8.0),
                    "tags": list(data.get("tags") or ["photo", "legacy"]),
                }

        except Exception as e:
            print(f"⚠️ Gemini Vision extraction failed, using heuristic fallback: {e}")

    # Heuristic Fallback for offline testing or without API key
    clean_name = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ")
    narrative = f"Archived image record ({filename}). "
    if user_context:
        narrative += f"Note: {user_context}."
    else:
        narrative += "Preserved in the personal memory archive with visual metadata."

    return {
        "title": f"Photo: {clean_name.capitalize()}",
        "narrative": narrative,
        "transcription": user_context if user_context else None,
        "category": "Family & Roots",
        "approximate_date": None,
        "importance": 8.0,
        "tags": ["photo", "image-record", "archive"],
    }

