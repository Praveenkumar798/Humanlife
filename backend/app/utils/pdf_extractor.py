"""
Human Legacy AI - PDF Text Extraction Utility

Extracts text from PDF documents page by page using pypdfium2,
preserving page numbers for source citations.
"""

import os
from typing import List, Dict, Any
import pypdfium2 as pdfium


def extract_pdf_pages(file_path: str) -> List[Dict[str, Any]]:
    """
    Extract text from a PDF file page by page.
    Returns a list of dicts: [{"page_number": int, "text": str, "char_count": int}]
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found at: {file_path}")

    pages = []
    doc = pdfium.PdfDocument(file_path)

    try:
        total_pages = len(doc)
        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]
            textpage = page.get_textpage()
            text = textpage.get_text_range()

            # Clean and normalize extracted text
            cleaned_text = text.strip() if text else ""
            if cleaned_text:
                pages.append({
                    "page_number": page_num,
                    "text": cleaned_text,
                    "char_count": len(cleaned_text),
                })
    finally:
        doc.close()

    return pages
