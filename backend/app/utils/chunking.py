"""
Human Legacy AI - Text Chunking Utility

Splits long texts into semantically meaningful chunks with overlap,
preserving metadata (such as PDF page number and source context).
"""

import re
from typing import List, Dict, Any, Optional


def chunk_text(
    text: str,
    chunk_size: int = 600,
    overlap: int = 100,
    base_metadata: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Split text into chunks of approximately `chunk_size` characters with `overlap`.
    Prefers splitting on paragraph boundaries (\n\n), then sentences (. ! ?),
    and finally whitespace to avoid truncating words.

    Returns a list of dicts:
    [
        {
            "content": str,
            "chunk_index": int,
            "char_count": int,
            "metadata": dict
        }
    ]
    """
    clean_text = text.strip()
    if not clean_text:
        return []

    # If text is already smaller than chunk_size, return it directly
    if len(clean_text) <= chunk_size:
        return [{
            "content": clean_text,
            "chunk_index": 0,
            "char_count": len(clean_text),
            "metadata": dict(base_metadata or {}),
        }]

    chunks: List[Dict[str, Any]] = []
    start = 0
    chunk_idx = 0
    text_length = len(clean_text)

    while start < text_length:
        end = start + chunk_size

        if end >= text_length:
            chunk_slice = clean_text[start:].strip()
            if chunk_slice:
                chunks.append({
                    "content": chunk_slice,
                    "chunk_index": chunk_idx,
                    "char_count": len(chunk_slice),
                    "metadata": dict(base_metadata or {}),
                })
            break

        # Look for natural breakpoint near `end`
        # 1. Check for paragraph break (\n\n) within last 150 chars of window
        search_window = clean_text[max(start, end - 150): min(text_length, end + 50)]
        para_break = search_window.rfind("\n\n")

        if para_break != -1 and para_break > 0:
            actual_end = max(start, end - 150) + para_break
        else:
            # 2. Check for sentence end (.!?)
            sentence_match = list(re.finditer(r"[.!?]\s+", search_window))
            if sentence_match:
                last_sentence = sentence_match[-1]
                actual_end = max(start, end - 150) + last_sentence.end()
            else:
                # 3. Check for whitespace
                space_break = search_window.rfind(" ")
                if space_break != -1:
                    actual_end = max(start, end - 150) + space_break
                else:
                    actual_end = end

        chunk_slice = clean_text[start:actual_end].strip()
        if chunk_slice:
            chunks.append({
                "content": chunk_slice,
                "chunk_index": chunk_idx,
                "char_count": len(chunk_slice),
                "metadata": dict(base_metadata or {}),
            })
            chunk_idx += 1

        # Advance start with overlap
        start = max(start + 1, actual_end - overlap)

    return chunks


def chunk_pdf_pages(
    pages: List[Dict[str, Any]],
    chunk_size: int = 600,
    overlap: int = 100,
    doc_metadata: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Chunk extracted PDF pages while preserving the specific page_number on each chunk.
    """
    all_chunks: List[Dict[str, Any]] = []
    global_idx = 0

    for page_data in pages:
        page_num = page_data["page_number"]
        page_text = page_data["text"]

        meta = dict(doc_metadata or {})
        meta["page_number"] = page_num

        page_chunks = chunk_text(
            text=page_text,
            chunk_size=chunk_size,
            overlap=overlap,
            base_metadata=meta,
        )

        for c in page_chunks:
            c["chunk_index"] = global_idx
            global_idx += 1
            all_chunks.append(c)

    return all_chunks

