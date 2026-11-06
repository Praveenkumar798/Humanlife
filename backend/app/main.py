"""
Human Legacy AI - Main FastAPI Application

Entry point for the backend server.
Configures CORS, routers, database initialization, and startup/shutdown events.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db, engine
from app.routers import health, auth, memories, uploads, chat, websocket_chat, websocket_voice, voice_fallback, biographer, export, family, podcast


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Runs init_db on startup and disposes engine on shutdown.
    """
    # Startup: initialize database tables and pgvector extension
    try:
        await init_db()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        print("   Make sure PostgreSQL is running and accessible.")

    yield

    # Shutdown: dispose database engine
    await engine.dispose()
    print("🔌 Database connection closed")


# Create FastAPI application
app = FastAPI(
    title="Human Legacy AI",
    description=(
        "A personalized AI memory assistant that preserves personal memories, "
        "life experiences, values, and decision-making examples. "
        "Uses RAG with Gemini LLM for evidence-grounded answers."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(memories.router)
app.include_router(uploads.router)
app.include_router(chat.router)
app.include_router(websocket_chat.router)
app.include_router(websocket_voice.router)
app.include_router(voice_fallback.router)
app.include_router(biographer.router)
app.include_router(export.router)
app.include_router(family.router)
app.include_router(podcast.router)

import os
from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Check if production frontend static build exists (for single-container cloud hosting on Render)
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")

if os.path.exists(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Do not intercept API, WebSocket, or documentation endpoints
        if (
            full_path.startswith("api/")
            or full_path.startswith("ws/")
            or full_path.startswith("docs")
            or full_path == "openapi.json"
        ):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
else:
    @app.get("/")
    async def root():
        """Root endpoint - application info."""
        return {
            "app": "Human Legacy AI",
            "version": "1.0.0",
            "description": "Personalized Memory Assistant",
            "docs": "/docs",
        }

