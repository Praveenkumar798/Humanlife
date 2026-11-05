"""
Unit and Integration Tests for Stage 5: Upload, Extraction, Chunking, and Embeddings

Tests PDF and TXT text extraction, recursive chunking, file validation,
job status tracking, retry mechanics, and Gemini embedding service.
"""

import io
import uuid
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import UploadFile, HTTPException

from app.models.user import User
from app.models.memory import Memory
from app.models.chunk import SourceFile, MemoryChunk
from app.models.processing import ProcessingJob
from app.utils.chunking import chunk_text, chunk_pdf_pages
from app.utils.txt_extractor import extract_txt_content
from app.services.embedding_service import get_gemini_client, generate_embedding
from app.services.upload_service import (
    save_uploaded_file,
    process_file_pipeline,
    get_job_status,
    retry_processing_job,
)
from app.routers.uploads import upload_file, check_upload_status


@pytest.fixture
def current_user():
    """Sample authenticated user."""
    return User(
        id=uuid.uuid4(),
        email="uploader@example.com",
        username="uploader",
        hashed_password="...",
        is_active=True,
    )


def test_chunk_text_basic():
    """Test text chunking splits text and respects overlap and breakpoints."""
    text = (
        "Paragraph one about my childhood in Hyderabad. It was a wonderful sunny time.\n\n"
        "Paragraph two describes how I learned mathematics and chess from my uncle.\n\n"
        "Paragraph three discusses my early university days studying engineering."
    )
    chunks = chunk_text(text, chunk_size=100, overlap=20, base_metadata={"source": "test"})

    assert len(chunks) >= 2
    for c in chunks:
        assert "content" in c
        assert "chunk_index" in c
        assert c["metadata"]["source"] == "test"
        assert len(c["content"]) > 0


def test_chunk_pdf_pages_preserves_page_numbers():
    """Verify chunk_pdf_pages attaches correct page_number to each chunk."""
    pages = [
        {"page_number": 1, "text": "This is page one content about career lessons and beginnings."},
        {"page_number": 2, "text": "This is page two content detailing personal values and ethics."},
    ]
    chunks = chunk_pdf_pages(pages, chunk_size=50, overlap=10)

    assert len(chunks) >= 2
    # Check that chunks from page 1 have page_number 1, and page 2 have 2
    page1_chunks = [c for c in chunks if c["metadata"]["page_number"] == 1]
    page2_chunks = [c for c in chunks if c["metadata"]["page_number"] == 2]

    assert len(page1_chunks) > 0
    assert len(page2_chunks) > 0


def test_txt_extractor_file(tmp_path):
    """Test reading and normalizing TXT file content."""
    txt_file = tmp_path / "test_diary.txt"
    txt_file.write_bytes(b"Line 1\r\nLine 2\r\nLine 3\n")

    content = extract_txt_content(str(txt_file))
    assert "Line 1\nLine 2\nLine 3" in content


def test_upload_file_validation_unsupported_type():
    """Test that unsupported file extensions (e.g. .docx, .png) are rejected with 400."""
    fake_file = UploadFile(
        filename="unsupported_file.docx",
        file=io.BytesIO(b"some content")
    )
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(save_uploaded_file(fake_file))

    assert exc_info.value.status_code == 400
    assert "Unsupported file type" in exc_info.value.detail


def test_upload_file_validation_empty():
    """Test that empty 0-byte files are rejected with 400."""
    fake_file = UploadFile(
        filename="empty.txt",
        file=io.BytesIO(b"")
    )
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(save_uploaded_file(fake_file))

    assert exc_info.value.status_code == 400
    assert "empty" in exc_info.value.detail.lower()


def test_embedding_service_missing_api_key():
    """Verify that calling embedding service without GEMINI_API_KEY raises 503."""
    with patch("app.services.embedding_service.settings.GEMINI_API_KEY", ""):
        with pytest.raises(HTTPException) as exc_info:
            get_gemini_client()
        assert exc_info.value.status_code == 503
        assert "not configured" in exc_info.value.detail


def test_process_file_pipeline_txt(current_user, tmp_path):
    """Test complete end-to-end processing pipeline for a TXT document."""
    txt_content = b"This is a journal entry about overcoming career adversity in 2019."
    fake_file = UploadFile(
        filename="career_journal.txt",
        file=io.BytesIO(txt_content)
    )

    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    # Mock batch embeddings (768 dimensions)
    mock_emb = [0.01] * 768
    with patch("app.services.upload_service.generate_embeddings_batch", new_callable=AsyncMock) as mock_embed_fn:
        mock_embed_fn.return_value = [mock_emb]

        source_file, job, memory = asyncio.run(
            process_file_pipeline(
                db=mock_db,
                user_id=current_user.id,
                file=fake_file,
                title="Career Journal",
                category="Career",
            )
        )

        assert memory.title == "Career Journal"
        assert memory.user_id == current_user.id
        assert source_file.filename == "career_journal.txt"
        assert source_file.status == "completed"
        assert job.status == "completed"
        assert job.error_message is None


def test_get_job_status(current_user):
    """Test retrieving job status and chunk count."""
    job_id = uuid.uuid4()
    mem_id = uuid.uuid4()

    mock_job = ProcessingJob(
        id=job_id,
        memory_id=mem_id,
        user_id=current_user.id,
        status="completed",
        job_type="txt_extraction_and_embedding",
    )
    mock_sf = SourceFile(
        id=uuid.uuid4(),
        user_id=current_user.id,
        memory_id=mem_id,
        filename="notes.txt",
        file_type="txt",
        file_path="/uploads/notes.txt",
        file_size=500,
        status="completed",
    )

    mock_db = AsyncMock()
    # 1. job query result
    res_job = MagicMock()
    res_job.scalar_one_or_none.return_value = mock_job
    # 2. chunk count result
    res_count = MagicMock()
    res_count.scalar.return_value = 5
    # 3. source file query result
    res_sf = MagicMock()
    res_sf.scalar_one_or_none.return_value = mock_sf

    mock_db.execute.side_effect = [res_job, res_count, res_sf]

    job, chunk_count, sf = asyncio.run(get_job_status(db=mock_db, job_id=job_id, user_id=current_user.id))

    assert job.id == job_id
    assert job.status == "completed"
    assert chunk_count == 5
    assert sf.filename == "notes.txt"


def test_upload_router_endpoints(current_user):
    """Test the upload router endpoint handlers directly."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    txt_content = b"Personal memories about childhood summer vacations."
    fake_file = UploadFile(
        filename="summer.txt",
        file=io.BytesIO(txt_content)
    )

    with patch("app.services.upload_service.generate_embeddings_batch", new_callable=AsyncMock) as mock_embed_fn:
        mock_embed_fn.return_value = [[0.05] * 768]

        res = asyncio.run(
            upload_file(
                file=fake_file,
                title="Summer Vacation",
                category="Childhood",
                current_user=current_user,
                db=mock_db
            )
        )

        assert res.filename == "summer.txt"
        assert res.file_type == "txt"
        assert res.status == "completed"
        assert "successfully" in res.message


def test_save_uploaded_file_image():
    """Verify image files (.jpg, .png) are accepted and saved."""
    fake_img = UploadFile(
        filename="wedding_1982.jpg",
        file=io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00")
    )
    stored_path, file_type, size, checksum = asyncio.run(save_uploaded_file(fake_img))
    assert file_type == "jpg"
    assert size > 0
    assert checksum


def test_extract_image_multimodal_mock():
    """Verify Gemini Vision JSON parsing for multimodal images."""
    import tempfile
    import os
    from app.utils.image_extractor import extract_image_multimodal

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(b"dummy-image-bytes")
        temp_path = f.name

    mock_json = (
        '{"title": "Wedding in Hyderabad",'
        '"narrative": "A warm black-and-white photograph of the 1982 wedding.",'
        '"transcription": null,'
        '"category": "Family & Roots",'
        '"approximate_date": "1982-05-14",'
        '"importance": 9.5,'
        '"tags": ["wedding", "hyderabad", "1982"]}'
    )

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.text = mock_json
    mock_client.models.generate_content.return_value = mock_resp

    try:
        with patch("app.utils.image_extractor.settings.GEMINI_API_KEY", "mock-key"):
            with patch("app.utils.image_extractor.get_gemini_client", return_value=mock_client):
                res = extract_image_multimodal(temp_path, user_context="Parents wedding")
                assert res["title"] == "Wedding in Hyderabad"
                assert "1982 wedding" in res["narrative"]
                assert res["importance"] == 9.5
                assert "wedding" in res["tags"]
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
