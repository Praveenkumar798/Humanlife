"""
Human Legacy AI - Uploads Router

Endpoints for uploading PDF and TXT memory files, checking processing status,
and retrying failed ingestion jobs.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.schemas.upload import UploadResponse, UploadStatusResponse
from app.services.upload_service import (
    process_file_pipeline,
    get_job_status,
    retry_processing_job,
)

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])


@router.post(
    "",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a PDF or TXT file for processing and vector embedding"
)
async def upload_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a PDF (.pdf) or Plain Text (.txt) document.
    Extracts text, splits into chunks, computes Gemini embeddings, and stores
    vectors in PostgreSQL with pgvector for RAG retrieval.
    """
    source_file, job, memory = await process_file_pipeline(
        db=db,
        user_id=current_user.id,
        file=file,
        title=title,
        category=category,
    )

    msg = "File processed and indexed successfully." if job.status == "completed" else "File uploaded; processing failed."

    return UploadResponse(
        file_id=source_file.id,
        memory_id=memory.id,
        job_id=job.id,
        filename=source_file.filename,
        file_type=source_file.file_type,
        file_size=source_file.file_size,
        status=job.status,
        message=msg,
    )


@router.get(
    "/{job_id}",
    response_model=UploadStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Check status of a file processing job"
)
async def check_upload_status(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check current status of a document processing job (pending, processing, completed, failed)
    and the number of vector chunks generated.
    """
    job, chunk_count, source_file = await get_job_status(db, job_id, current_user.id)

    return UploadStatusResponse(
        job_id=job.id,
        memory_id=job.memory_id,
        file_id=source_file.id if source_file else None,
        filename=source_file.filename if source_file else None,
        status=job.status,
        job_type=job.job_type,
        chunks_created=chunk_count,
        error_message=job.error_message,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


@router.post(
    "/{job_id}/retry",
    response_model=UploadStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Retry a failed file processing job"
)
async def retry_upload(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Re-trigger text extraction, chunking, and embedding generation for a failed upload.
    """
    job = await retry_processing_job(db, job_id, current_user.id)
    _, chunk_count, source_file = await get_job_status(db, job_id, current_user.id)

    return UploadStatusResponse(
        job_id=job.id,
        memory_id=job.memory_id,
        file_id=source_file.id if source_file else None,
        filename=source_file.filename if source_file else None,
        status=job.status,
        job_type=job.job_type,
        chunks_created=chunk_count,
        error_message=job.error_message,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )

