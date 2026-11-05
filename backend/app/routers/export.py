"""
Human Legacy AI - Export Router

Endpoints for exporting personal legacy books and printable memoir PDFs.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.services.memoir_pdf_service import generate_memoir_book_pdf

router = APIRouter(prefix="/api/export", tags=["Export"])


@router.get(
    "/memoir-pdf",
    summary="Generate and download a printable hardcover-style Memoir Book (PDF)",
    response_class=Response,
)
async def download_memoir_pdf(
    book_title: Optional[str] = Query(None, description="Custom title for the memoir book"),
    include_prologue: bool = Query(True, description="Whether to include dedication prologue"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Assembles all user memories into a publication-grade, printable PDF book with:
    Cover page, Table of Contents, chronological chapters, and archival colophon.
    """
    pdf_bytes = await generate_memoir_book_pdf(
        db=db,
        user_id=current_user.id,
        user=current_user,
        book_title=book_title,
        include_prologue=include_prologue,
    )

    clean_username = current_user.username.replace(" ", "_")
    filename = f"Legacy_Memoir_{clean_username}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/pdf",
        },
    )
