"""
Unit and Integration Tests for Stage 6: RAG Retrieval and Grounded Chatbot

Tests semantic similarity search, prompt construction, anti-hallucination rules,
source citations, conversation persistence, and user ownership isolation.
"""

import uuid
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.models.user import User
from app.models.conversation import Conversation, ConversationMessage
from app.schemas.chat import (
    SourceCitation,
    ChatRequest,
    ChatResponse,
)
from app.services.rag_service import (
    construct_rag_prompt,
    generate_grounded_answer,
    search_relevant_chunks,
    FALLBACK_INSUFFICIENT_INFO,
)
from app.services.chat_service import (
    process_chat_message,
    list_user_conversations,
    get_conversation_details,
    delete_conversation,
)
from app.routers.chat import chat, get_conversations, remove_conversation


@pytest.fixture
def current_user():
    """Sample authenticated user."""
    return User(
        id=uuid.uuid4(),
        email="chat_user@example.com",
        username="chatuser",
        hashed_password="...",
        is_active=True,
    )


def test_construct_rag_prompt():
    """Test that construct_rag_prompt builds a strictly grounded prompt with citations."""
    citations = [
        SourceCitation(
            memory_id=uuid.uuid4(),
            memory_title="Grandfather's Advice",
            source_type="text",
            filename=None,
            page_number=None,
            chunk_text="Always stay humble and prioritize honesty above short-term gain.",
            similarity_score=0.88,
        ),
        SourceCitation(
            memory_id=uuid.uuid4(),
            memory_title="Engineering College",
            source_type="pdf",
            filename="college_diary.pdf",
            page_number=4,
            chunk_text="Graduated in 2012 with a degree in computer systems.",
            similarity_score=0.76,
        ),
    ]

    question = "What did your grandfather teach you about honesty?"
    prompt = construct_rag_prompt(question, citations)

    # Must contain critical instructions
    assert "Anti-Hallucination" in prompt
    assert FALLBACK_INSUFFICIENT_INFO in prompt
    assert "Grandfather's Advice" in prompt
    assert "college_diary.pdf" in prompt
    assert "Page: 4" in prompt
    assert question in prompt


def test_generate_grounded_answer_empty_citations():
    """When no sources are retrieved, must return fallback without calling LLM."""
    answer, is_grounded = asyncio.run(generate_grounded_answer("Any question?", []))
    assert answer == FALLBACK_INSUFFICIENT_INFO
    assert is_grounded is False


def test_generate_grounded_answer_with_mock_gemini():
    """Test generating answer with mock Gemini LLM output."""
    citations = [
        SourceCitation(
            memory_id=uuid.uuid4(),
            memory_title="First Business",
            source_type="text",
            chunk_text="Founded the company with 50,000 rupees in 2015.",
            similarity_score=0.92,
        )
    ]

    mock_gemini_resp = MagicMock()
    mock_gemini_resp.text = "Based on [First Business], the company was founded in 2015 with 50,000 rupees."

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_gemini_resp

    with patch("app.services.rag_service.get_gemini_client", return_value=mock_client):
        answer, is_grounded = asyncio.run(
            generate_grounded_answer("When did you start your business?", citations)
        )

        assert "50,000 rupees" in answer
        assert "First Business" in answer
        assert is_grounded is True


def test_search_relevant_chunks_pgvector(current_user):
    """Test similarity calculation and filtering in search_relevant_chunks."""
    mock_db = AsyncMock()

    # Mock chunk row: (MemoryChunk, memory_title, source_type, filename, distance)
    mock_chunk = MagicMock()
    mock_chunk.memory_id = uuid.uuid4()
    mock_chunk.content = "Overcame a difficult project deadline in 2020."
    mock_chunk.chunk_metadata = {"page_number": 2}

    # distance = 0.2 -> similarity = 1 - 0.2 = 0.8
    mock_row = (mock_chunk, "Project Phoenix", "pdf", "report.pdf", 0.20)

    mock_result = MagicMock()
    mock_result.all.return_value = [mock_row]
    mock_db.execute.return_value = mock_result

    dummy_embedding = [0.1] * 768
    citations = asyncio.run(
        search_relevant_chunks(
            db=mock_db,
            user_id=current_user.id,
            query_embedding=dummy_embedding,
            top_k=5,
            similarity_threshold=0.7,
        )
    )

    assert len(citations) == 1
    assert citations[0].memory_title == "Project Phoenix"
    assert citations[0].similarity_score == 0.8
    assert citations[0].page_number == 2


def test_process_chat_message_flow(current_user):
    """Test complete flow of submitting a chat question and persisting messages."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    # Mock query embedding
    dummy_query_emb = [0.05] * 768
    # Mock citation
    citation = SourceCitation(
        memory_id=uuid.uuid4(),
        memory_title="Life Lesson",
        source_type="text",
        chunk_text="Patience is the foundation of long-term success.",
        similarity_score=0.85,
    )

    with patch("app.services.rag_service.generate_embedding", new_callable=AsyncMock) as mock_embed, \
         patch("app.services.rag_service.search_relevant_chunks", new_callable=AsyncMock) as mock_search, \
         patch("app.services.rag_service.generate_grounded_answer", new_callable=AsyncMock) as mock_gen:

        mock_embed.return_value = dummy_query_emb
        mock_search.return_value = [citation]
        mock_gen.return_value = ("According to [Life Lesson], patience leads to success.", True)

        req = ChatRequest(
            message="What is the key to success?",
            top_k=5,
            similarity_threshold=0.7,
        )

        response: ChatResponse = asyncio.run(
            process_chat_message(db=mock_db, user_id=current_user.id, request=req)
        )

        assert response.is_grounded is True
        assert "patience" in response.answer.lower()
        assert len(response.sources) == 1
        assert response.sources[0].memory_title == "Life Lesson"


def test_conversations_listing_and_deletion(current_user):
    """Test listing and deleting conversations."""
    convo_id = uuid.uuid4()
    convo = Conversation(
        id=convo_id,
        user_id=current_user.id,
        title="Chat about principles",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    mock_db = AsyncMock()
    # Mock list
    list_res = MagicMock()
    list_res.scalars.return_value.all.return_value = [convo]
    count_res = MagicMock()
    count_res.scalar.return_value = 2
    mock_db.execute.side_effect = [list_res, count_res]

    convos = asyncio.run(list_user_conversations(db=mock_db, user_id=current_user.id))
    assert len(convos) == 1
    assert convos[0].id == convo_id
    assert convos[0].message_count == 2

    # Mock delete
    del_res = MagicMock()
    del_res.scalar_one_or_none.return_value = convo
    mock_db.execute.side_effect = None
    mock_db.execute.return_value = del_res
    mock_db.delete = AsyncMock()

    deleted = asyncio.run(delete_conversation(db=mock_db, conversation_id=convo_id, user_id=current_user.id))
    assert deleted is True


def test_chat_router_endpoint(current_user):
    """Test chat router endpoint handler directly."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    with patch("app.services.chat_service.execute_rag_pipeline", new_callable=AsyncMock) as mock_rag:
        mock_rag.return_value = (
            "Grounded answer based on stored memories.",
            [],
            True,
        )

        req = ChatRequest(message="Tell me about your values.")
        res = asyncio.run(chat(request=req, current_user=current_user, db=mock_db))

        assert res.answer == "Grounded answer based on stored memories."
        assert res.conversation_id is not None
