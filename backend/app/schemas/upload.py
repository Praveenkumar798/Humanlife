"""
Human Legacy AI - Upload Schemas

Pydantic models for PDF/TXT file upload requests, processing job status, and retries.
"""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class UploadResponse(BaseModel):
    """Initial response returned upon uploading a file."""
    file_id: uuid.UUID
    memory_id: uuid.UUID
    job_id: uuid.UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    message: str

    model_config = {
        "from_attributes": True
    }


class UploadStatusResponse(BaseModel):
    """Status details for a file ingestion/processing job."""
    job_id: uuid.UUID
    memory_id: uuid.UUID
    file_id: Optional[uuid.UUID] = None
    filename: Optional[str] = None
    status: str  # pending, processing, completed, failed
    job_type: str
    chunks_created: int = 0
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }
