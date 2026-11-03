"""
Unit tests for Health Check & Root Endpoints
"""

import asyncio
from unittest.mock import AsyncMock, patch
from app.config import settings
from app.main import root
from app.routers.health import health_check, readiness_check


def test_root_endpoint_metadata():
    """Test the root endpoint returns correct application metadata."""
    data = asyncio.run(root())
    assert data["app"] == "Human Legacy AI"
    assert "version" in data
    assert data["docs"] == "/docs"


def test_health_endpoint_status():
    """Test the /health endpoint returns healthy status and environment."""
    data = asyncio.run(health_check())
    assert data["status"] == "healthy"
    assert data["app"] == "Human Legacy AI"
    assert data["environment"] == "development"


def test_readiness_endpoint_offline_db():
    """Test the /health/ready endpoint returns degraded status when database is offline."""
    mock_db = AsyncMock()
    mock_db.execute.side_effect = Exception("Database connection failed")

    data = asyncio.run(readiness_check(db=mock_db))
    assert data["status"] == "degraded"
    assert "checks" in data
    assert data["checks"]["database"] is False
    assert data["checks"]["pgvector"] is False
    assert "gemini_configured" in data["checks"]


def test_readiness_endpoint_healthy_mock():
    """Test the /health/ready endpoint returns ready status when all checks pass."""
    from unittest.mock import MagicMock
    mock_db = AsyncMock()
    # Mock first execute (SELECT 1) and second execute (SELECT vector extension)
    mock_res_1 = MagicMock()
    mock_res_1.scalar.return_value = 1
    mock_res_2 = MagicMock()
    mock_res_2.scalar.return_value = True
    mock_db.execute.side_effect = [mock_res_1, mock_res_2]

    with patch.object(settings, "GEMINI_API_KEY", "mock-test-key-12345"):
        data = asyncio.run(readiness_check(db=mock_db))
        assert data["status"] == "ready"
        assert data["checks"]["database"] is True
        assert data["checks"]["pgvector"] is True
        assert data["checks"]["gemini_configured"] is True
