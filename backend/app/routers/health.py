"""
Human Legacy AI - Health Check Router

Provides health and readiness endpoints for monitoring.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """
    Basic health check - returns application status.
    Does not require authentication.
    """
    return {
        "status": "healthy",
        "app": "Human Legacy AI",
        "version": "1.0.0",
        "environment": settings.APP_ENV,
    }


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Readiness check - verifies database connection and pgvector extension.
    """
    checks = {
        "database": False,
        "pgvector": False,
        "gemini_configured": False,
    }

    # Check database connection
    try:
        result = await db.execute(text("SELECT 1"))
        row = result.scalar()
        checks["database"] = row == 1
    except Exception:
        checks["database"] = False

    # Check pgvector extension
    try:
        result = await db.execute(
            text("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector')")
        )
        checks["pgvector"] = result.scalar() is True
    except Exception:
        checks["pgvector"] = False

    # Check Gemini API key is configured (not the actual key value)
    checks["gemini_configured"] = settings.GEMINI_API_KEY is not None and len(settings.GEMINI_API_KEY) > 0

    all_healthy = all(checks.values())

    return {
        "status": "ready" if all_healthy else "degraded",
        "checks": checks,
    }

