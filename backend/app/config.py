"""
Human Legacy AI - Application Configuration

Loads all settings from environment variables with sensible defaults.
Uses pydantic-settings for validation and type coercion.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://humanlegacy:changeme@localhost:5432/humanlegacy_db"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://humanlegacy:changeme@localhost:5432/humanlegacy_db"
    POSTGRES_USER: Optional[str] = "humanlegacy"
    POSTGRES_PASSWORD: Optional[str] = "changeme"
    POSTGRES_DB: Optional[str] = "humanlegacy_db"
    POSTGRES_HOST: Optional[str] = "localhost"
    POSTGRES_PORT: Optional[int] = 5432

    # --- JWT Authentication ---
    JWT_SECRET_KEY: str = "change-this-to-a-secure-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours

    # --- Gemini API ---
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_LLM_MODEL: str = "gemini-2.0-flash"
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"
    GEMINI_LIVE_MODEL: str = "gemini-2.0-flash-live-001"

    # --- Embedding Configuration ---
    EMBEDDING_DIMENSIONS: int = 768

    # --- RAG Configuration ---
    RAG_TOP_K: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.7

    # --- File Upload ---
    MAX_UPLOAD_SIZE_MB: int = 50

    # --- CORS ---
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # --- Application ---
    APP_ENV: str = "development"
    APP_DEBUG: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def max_upload_size_bytes(self) -> int:
        """Convert MB to bytes for file upload validation."""
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


# Singleton settings instance
settings = Settings()

