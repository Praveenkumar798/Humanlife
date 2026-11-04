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
from app.routers import health, auth, memories, uploads, chat, websocket_chat


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


@app.get("/")
async def root():
    """Root endpoint - application info."""
    return {
        "app": "Human Legacy AI",
        "version": "1.0.0",
        "description": "Personalized Memory Assistant",
        "docs": "/docs",
    }

