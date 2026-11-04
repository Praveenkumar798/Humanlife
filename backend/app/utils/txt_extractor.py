"""
Human Legacy AI - TXT Text Extraction Utility

Extracts and cleans raw text from uploaded TXT files.
"""

import os


def extract_txt_content(file_path: str) -> str:
    """
    Read and clean text from a .txt file.
    Attempts UTF-8 first, with fallback to latin-1 encoding.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"TXT file not found at: {file_path}")

    # Try utf-8 first
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(file_path, "r", encoding="latin-1", errors="replace") as f:
            content = f.read()

    # Normalize line endings and strip trailing whitespace
    normalized = content.replace("\r\n", "\n").replace("\r", "\n").strip()
    return normalized

