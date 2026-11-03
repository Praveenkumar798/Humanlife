"""
Unit tests for SQLAlchemy Models Definition & Integrity
"""

import uuid
from datetime import date
from app.models.user import User
from app.models.memory import Memory
from app.models.chunk import MemoryChunk, SourceFile
from app.models.conversation import Conversation, ConversationMessage
from app.models.processing import ProcessingJob, UserSettings


def test_user_model_instantiation():
    """Test user model instantiation and defaults."""
    u = User(
        email="test@example.com",
        username="testuser",
        hashed_password="fakehashedpassword123",
        full_name="Test User",
        is_active=True,
    )
    assert u.email == "test@example.com"
    assert u.username == "testuser"
    assert u.is_active is True
    assert "User(" in repr(u)


def test_memory_model_blueprint_fields():
    """Test memory model has blueprint-required fields."""
    user_id = uuid.uuid4()
    m = Memory(
        user_id=user_id,
        title="College Graduation",
        content="Graduated with honors in Computer Science.",
        category="Education",
        tags=["graduation", "university"],
        memory_type="episodic",
        importance=8.5,
        verification_status="owner_confirmed",
        event_date=date(2020, 5, 15),
        source_type="text",
    )
    assert m.title == "College Graduation"
    assert m.memory_type == "episodic"
    assert m.importance == 8.5
    assert m.verification_status == "owner_confirmed"
    assert m.event_date == date(2020, 5, 15)
    assert m.source_type == "text"


def test_chunk_and_file_model():
    """Test chunk and source file models."""
    user_id = uuid.uuid4()
    memory_id = uuid.uuid4()
    sf = SourceFile(
        user_id=user_id,
        memory_id=memory_id,
        filename="diary.txt",
        file_type="txt",
        file_path="/uploads/diary.txt",
        file_size=1024,
        status="completed",
    )
    assert sf.filename == "diary.txt"
    assert sf.status == "completed"

    chunk = MemoryChunk(
        memory_id=memory_id,
        user_id=user_id,
        content="This is a test chunk",
        chunk_index=0,
        model_name="text-embedding-004",
        model_version="1",
    )
    assert chunk.content == "This is a test chunk"
    assert chunk.model_name == "text-embedding-004"


def test_conversation_models():
    """Test conversation and message models."""
    user_id = uuid.uuid4()
    convo = Conversation(
        user_id=user_id,
        title="Chat about childhood",
    )
    assert convo.title == "Chat about childhood"

    msg = ConversationMessage(
        conversation_id=convo.id,
        role="user",
        content="What was my earliest memory?",
        sources=None,
    )
    assert msg.role == "user"
    assert msg.content == "What was my earliest memory?"


def test_processing_job_model():
    """Test processing job and user settings models."""
    user_id = uuid.uuid4()
    memory_id = uuid.uuid4()
    job = ProcessingJob(
        memory_id=memory_id,
        user_id=user_id,
        status="pending",
        job_type="text_chunking",
    )
    assert job.status == "pending"
    assert job.job_type == "text_chunking"

    settings = UserSettings(
        user_id=user_id,
        retrieval_chunks=5,
        similarity_threshold=0.75,
    )
    assert settings.retrieval_chunks == 5
    assert settings.similarity_threshold == 0.75
