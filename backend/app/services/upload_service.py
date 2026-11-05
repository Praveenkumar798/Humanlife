"""
Human Legacy AI - Upload Processing Service

Orchestrates file upload validation, secure storage, text extraction (PDF/TXT),
chunking, Gemini vector embedding generation, and pgvector persistence.
"""

import os
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.memory import Memory
from app.models.chunk import SourceFile, MemoryChunk
from app.models.processing import ProcessingJob
from app.utils.pdf_extractor import extract_pdf_pages
from app.utils.txt_extractor import extract_txt_content
from app.utils.chunking import chunk_text, chunk_pdf_pages
from app.utils.image_extractor import extract_image_multimodal, IMAGE_MIME_TYPES
from app.services.embedding_service import generate_embeddings_batch

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_EXTENSIONS = {".pdf", ".txt"} | IMAGE_EXTENSIONS


def compute_sha256(content: bytes) -> str:
    """Calculate SHA-256 checksum of file bytes for integrity verification."""
    return hashlib.sha256(content).hexdigest()


async def save_uploaded_file(file: UploadFile) -> Tuple[str, str, int, str]:
    """
    Validate and save the uploaded file to disk.
    Returns: (stored_file_path, file_extension, file_size, checksum)
    """
    # 1. Validate file extension
    filename = file.filename or "unknown"
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF (.pdf), TXT (.txt), and Images (.jpg, .jpeg, .png, .webp).",
        )

    # 2. Read content and validate size
    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if file_size > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    # 3. Secure storage path
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    unique_filename = f"{uuid.uuid4()}_{os.path.basename(filename)}"
    stored_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(stored_path, "wb") as f:
        f.write(content)

    checksum = compute_sha256(content)
    file_type = ext.lstrip(".")

    return stored_path, file_type, file_size, checksum


async def process_file_pipeline(
    db: AsyncSession,
    user_id: uuid.UUID,
    file: UploadFile,
    title: Optional[str] = None,
    category: Optional[str] = None,
) -> Tuple[SourceFile, ProcessingJob, Memory]:
    """
    Complete end-to-end processing pipeline:
    Save file -> Create records -> Extract text -> Chunk -> Embed -> Store in pgvector.
    """
    filename = file.filename or "Uploaded Document"
    stored_path, file_type, file_size, checksum = await save_uploaded_file(file)

    # Derive title if not provided
    memory_title = title.strip() if title else os.path.splitext(filename)[0]

    # Create Memory record
    memory = Memory(
        id=uuid.uuid4(),
        user_id=user_id,
        title=memory_title,
        content=f"Uploaded document: {filename}",
        category=category.strip() if category else "Documents",
        source_type=file_type,
        verification_status="unverified",
    )
    db.add(memory)
    await db.flush()

    # Create SourceFile record
    source_file = SourceFile(
        id=uuid.uuid4(),
        user_id=user_id,
        memory_id=memory.id,
        filename=filename,
        file_type=file_type,
        file_path=stored_path,
        file_size=file_size,
        status="processing",
        checksum=checksum,
    )
    db.add(source_file)
    await db.flush()

    # Create ProcessingJob record
    job = ProcessingJob(
        id=uuid.uuid4(),
        memory_id=memory.id,
        user_id=user_id,
        status="processing",
        job_type=f"{file_type}_extraction_and_embedding",
    )
    db.add(job)
    await db.commit()

    # Run extraction, chunking, and embedding
    try:
        chunks_data = []
        if file_type == "pdf":
            pages = extract_pdf_pages(stored_path)
            if not pages:
                raise ValueError("No extractable text found in PDF document.")
            chunks_data = chunk_pdf_pages(
                pages=pages,
                chunk_size=600,
                overlap=100,
                doc_metadata={"filename": filename, "source_type": "pdf"},
            )
        elif file_type == "txt":
            raw_text = extract_txt_content(stored_path)
            if not raw_text:
                raise ValueError("No extractable text found in TXT file.")
            chunks_data = chunk_text(
                text=raw_text,
                chunk_size=600,
                overlap=100,
                base_metadata={"filename": filename, "source_type": "txt"},
            )
        elif f".{file_type}" in IMAGE_EXTENSIONS or file_type in {"jpg", "jpeg", "png", "webp"}:
            vision_data = extract_image_multimodal(stored_path, user_context=title)
            memory.title = title.strip() if title else vision_data["title"]
            memory.content = vision_data["narrative"]
            if vision_data.get("category"):
                memory.category = category.strip() if category else vision_data["category"]
            memory.source_type = "photo"
            if vision_data.get("importance"):
                memory.importance = vision_data["importance"]
            if vision_data.get("tags"):
                memory.tags = vision_data["tags"]
            if vision_data.get("approximate_date"):
                try:
                    memory.event_date = datetime.strptime(str(vision_data["approximate_date"])[:10], "%Y-%m-%d").date()
                except Exception:
                    pass

            text_to_chunk = vision_data["narrative"]
            if vision_data.get("transcription"):
                text_to_chunk += f"\n\nTranscribed Content:\n{vision_data['transcription']}"

            chunks_data = chunk_text(
                text=text_to_chunk,
                chunk_size=600,
                overlap=100,
                base_metadata={"filename": filename, "source_type": "photo"},
            )

        if not chunks_data:
            raise ValueError("Document yielded no text chunks.")

        # Update memory content summary for documents
        if file_type in {"pdf", "txt"}:
            first_few = " ".join([c["content"] for c in chunks_data[:3]])
            memory.content = first_few[:2000]

        # Generate Gemini embeddings for each chunk
        texts = [c["content"] for c in chunks_data]
        embeddings = await generate_embeddings_batch(texts)

        # Store chunks and vector embeddings in PostgreSQL
        for c, emb in zip(chunks_data, embeddings):
            chunk_record = MemoryChunk(
                memory_id=memory.id,
                source_file_id=source_file.id,
                user_id=user_id,
                content=c["content"],
                chunk_index=c["chunk_index"],
                chunk_metadata=c.get("metadata"),
                model_name=settings.GEMINI_EMBEDDING_MODEL,
                model_version="1",
                embedding=emb,
            )
            db.add(chunk_record)

        # Mark job and file as completed
        source_file.status = "completed"
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()

    except Exception as e:
        # Mark as failed with clear error message (do NOT mark failed as success)
        source_file.status = "failed"
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()
        # Don't re-raise as HTTP error if records were created; user checks job status
        print(f"❌ File processing job failed: {e}")

    await db.refresh(source_file)
    await db.refresh(job)
    await db.refresh(memory)
    return source_file, job, memory


async def get_job_status(
    db: AsyncSession,
    job_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Tuple[ProcessingJob, int, Optional[SourceFile]]:
    """Retrieve job status, chunk count, and source file for the user."""
    stmt = select(ProcessingJob).where(
        ProcessingJob.id == job_id,
        ProcessingJob.user_id == user_id
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processing job not found.",
        )

    # Count chunks created so far
    count_stmt = select(func.count()).select_from(MemoryChunk).where(
        MemoryChunk.memory_id == job.memory_id,
        MemoryChunk.user_id == user_id
    )
    count_result = await db.execute(count_stmt)
    chunk_count = count_result.scalar() or 0

    # Get source file
    sf_stmt = select(SourceFile).where(SourceFile.memory_id == job.memory_id)
    sf_result = await db.execute(sf_stmt)
    source_file = sf_result.scalar_one_or_none()

    return job, chunk_count, source_file


async def retry_processing_job(
    db: AsyncSession,
    job_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ProcessingJob:
    """
    Retry a failed processing job.
    Deletes any partial chunks and re-runs extraction and embedding.
    """
    job, _, source_file = await get_job_status(db, job_id, user_id)

    if not source_file or not os.path.exists(source_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original source file is no longer available on disk.",
        )

    # Delete existing partial chunks
    delete_stmt = select(MemoryChunk).where(MemoryChunk.memory_id == job.memory_id)
    chunks_to_del = (await db.execute(delete_stmt)).scalars().all()
    for chk in chunks_to_del:
        await db.delete(chk)

    # Reset statuses
    job.status = "processing"
    job.error_message = None
    job.completed_at = None
    source_file.status = "processing"
    await db.commit()

    # Re-run pipeline
    try:
        if source_file.file_type == "pdf":
            pages = extract_pdf_pages(source_file.file_path)
            chunks_data = chunk_pdf_pages(
                pages=pages,
                chunk_size=600,
                overlap=100,
                doc_metadata={"filename": source_file.filename, "source_type": "pdf"},
            )
        elif source_file.file_type == "txt":
            raw_text = extract_txt_content(source_file.file_path)
            chunks_data = chunk_text(
                text=raw_text,
                chunk_size=600,
                overlap=100,
                base_metadata={"filename": source_file.filename, "source_type": "txt"},
            )
        elif f".{source_file.file_type}" in IMAGE_EXTENSIONS or source_file.file_type in {"jpg", "jpeg", "png", "webp", "photo"}:
            vision_data = extract_image_multimodal(source_file.file_path, user_context=source_file.filename)
            text_to_chunk = vision_data["narrative"]
            if vision_data.get("transcription"):
                text_to_chunk += f"\n\nTranscribed Content:\n{vision_data['transcription']}"
            chunks_data = chunk_text(
                text=text_to_chunk,
                chunk_size=600,
                overlap=100,
                base_metadata={"filename": source_file.filename, "source_type": "photo"},
            )
        else:
            raw_text = extract_txt_content(source_file.file_path)
            chunks_data = chunk_text(
                text=raw_text,
                chunk_size=600,
                overlap=100,
                base_metadata={"filename": source_file.filename, "source_type": source_file.file_type},
            )

        texts = [c["content"] for c in chunks_data]
        embeddings = await generate_embeddings_batch(texts)

        for c, emb in zip(chunks_data, embeddings):
            chunk_record = MemoryChunk(
                memory_id=job.memory_id,
                source_file_id=source_file.id,
                user_id=user_id,
                content=c["content"],
                chunk_index=c["chunk_index"],
                chunk_metadata=c.get("metadata"),
                model_name=settings.GEMINI_EMBEDDING_MODEL,
                model_version="1",
                embedding=emb,
            )
            db.add(chunk_record)

        source_file.status = "completed"
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()

    except Exception as e:
        source_file.status = "failed"
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()

    await db.refresh(job)
    return job
