"""
Human Legacy AI - RAG (Retrieval-Augmented Generation) Service

Executes semantic similarity search over stored pgvector embeddings,
constructs strict evidence-grounded prompts, and queries Gemini LLM
to generate source-cited answers without hallucination.
"""

import uuid
import inspect
from typing import List, Tuple, Optional, AsyncGenerator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.config import settings
from app.models.memory import Memory
from app.models.chunk import MemoryChunk, SourceFile
from app.schemas.chat import SourceCitation
from app.services.embedding_service import generate_embedding, get_gemini_client

FALLBACK_INSUFFICIENT_INFO = "I could not find enough information in the stored memories to answer that."

CONVERSATIONAL_PHRASES = {
    "ok", "okay", "k", "sure", "got it", "cool", "alright", "all right",
    "thanks", "thank you", "thx", "thank u", "thank you so much", "many thanks",
    "hello", "hi", "hey", "good morning", "good evening", "good afternoon", "good night",
    "bye", "goodbye", "see you", "great", "nice", "understood", "yes", "no", "awesome",
}


def is_conversational_acknowledgement(text: str) -> bool:
    """Check if the user message is a conversational greeting or acknowledgment."""
    clean = text.strip().lower().rstrip(".!?,:; ")
    return clean in CONVERSATIONAL_PHRASES


async def search_relevant_chunks(
    db: AsyncSession,
    user_id: uuid.UUID,
    query_embedding: List[float],
    top_k: int = 5,
    similarity_threshold: float = 0.5,
) -> List[SourceCitation]:
    """
    Search memory chunks in PostgreSQL using pgvector cosine distance.
    Filters strictly by user_id to prevent cross-user data leakage.
    Returns list of SourceCitation objects with similarity scores.
    """
    # Cosine distance expression using pgvector
    distance_expr = MemoryChunk.embedding.cosine_distance(query_embedding).label("distance")

    stmt = (
        select(
            MemoryChunk,
            Memory.title.label("memory_title"),
            Memory.source_type.label("source_type"),
            SourceFile.filename.label("filename"),
            distance_expr,
        )
        .join(Memory, MemoryChunk.memory_id == Memory.id)
        .outerjoin(SourceFile, MemoryChunk.source_file_id == SourceFile.id)
        .where(
            MemoryChunk.user_id == user_id,
            MemoryChunk.embedding.isnot(None),
        )
        .order_by("distance")
        .limit(top_k)
    )

    result = await db.execute(stmt)
    rows = result.all()

    citations: List[SourceCitation] = []
    for row in rows:
        chunk: MemoryChunk = row[0]
        mem_title: str = row[1]
        src_type: str = row[2]
        fname: Optional[str] = row[3]
        distance: float = float(row[4]) if row[4] is not None else 1.0

        # Cosine similarity = 1 - cosine distance
        similarity = round(max(0.0, 1.0 - distance), 4)

        if similarity >= similarity_threshold:
            meta = chunk.chunk_metadata or {}
            page_num = meta.get("page_number")

            citations.append(
                SourceCitation(
                    memory_id=chunk.memory_id,
                    memory_title=mem_title,
                    source_type=src_type or "text",
                    filename=fname,
                    page_number=page_num,
                    chunk_text=chunk.content,
                    similarity_score=similarity,
                )
            )

    return citations


def construct_rag_prompt(question: str, citations: List[SourceCitation]) -> str:
    """
    Assemble a strictly grounded prompt instructing Gemini to base its
    answer solely on the retrieved memory excerpts and cite sources.
    """
    context_blocks = []
    for idx, c in enumerate(citations, 1):
        source_label = f"Source {idx}: [{c.memory_title}]"
        if c.filename:
            source_label += f" (File: {c.filename}"
            if c.page_number:
                source_label += f", Page: {c.page_number}"
            source_label += ")"
        context_blocks.append(f"{source_label}\nContent: {c.chunk_text}")

    context_str = "\n\n---\n\n".join(context_blocks)

    prompt = f"""You are the Human Legacy AI Assistant, dedicated to preserving and sharing a person's life memories, experiences, principles, and decision-making history for their family and future generations.

CRITICAL INSTRUCTIONS:
1. Grounding Rule: Answer the user's question using ONLY the provided memory sources below.
2. Anti-Hallucination: Do NOT invent, assume, or extrapolate any personal facts, dates, or stories that are not explicitly documented in the sources.
3. Insufficient Evidence: If the provided sources do not contain enough facts to answer the question accurately, you MUST respond EXACTLY with:
"{FALLBACK_INSUFFICIENT_INFO}"
4. Citations: Reference the source memory titles or document page numbers where relevant.
5. Tone: Respectful, truthful, reflective, and clear. Clearly distinguish documented facts from reasonable inferences.
6. Identity: You are an AI preservation assistant. Do not claim to possess human consciousness or to be the actual living person.
7. Multilingual Response Rule: Always match the language and script of the user's question!
   - If the user asks in Telugu (or Tanglish in English letters), answer in warm, fluent spoken Telugu.
   - If the user asks in Hindi (or Hinglish), answer in warm, fluent spoken Hindi.
   - If the user asks in English, answer in English.
   - Accurately translate and express the documented facts from English sources into the requested language (Telugu or Hindi) while preserving complete factual precision.

DOCUMENTED MEMORY SOURCES:
----------------------------------------
{context_str}
----------------------------------------

USER QUESTION:
{question}

GROUNDED ANSWER:"""

    return prompt


async def generate_grounded_answer(
    question: str,
    citations: List[SourceCitation],
    conversational_prompt: Optional[str] = None,
) -> Tuple[str, bool]:
    """
    Query Gemini LLM with the grounded prompt or conversational prompt.
    Returns: (answer_text, is_grounded)
    """
    if not citations and not conversational_prompt:
        return FALLBACK_INSUFFICIENT_INFO, False

    prompt = conversational_prompt if conversational_prompt else construct_rag_prompt(question, citations)
    client = get_gemini_client()

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_LLM_MODEL,
            contents=prompt,
        )

        answer = response.text.strip() if response and response.text else FALLBACK_INSUFFICIENT_INFO
        is_grounded = bool(citations) and (FALLBACK_INSUFFICIENT_INFO not in answer)

        return answer, is_grounded

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate answer from Gemini model: {str(e)}",
        )


async def generate_grounded_answer_stream(
    question: str,
    citations: List[SourceCitation],
    conversational_prompt: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream grounded answer tokens from Gemini LLM.
    If no relevant chunks exist, yields standard fallback string directly.
    Supports both async iterator and generator fallback.
    """
    if not citations and not conversational_prompt:
        yield FALLBACK_INSUFFICIENT_INFO
        return

    prompt = conversational_prompt if conversational_prompt else construct_rag_prompt(question, citations)
    client = get_gemini_client()

    try:
        # Check async client.aio first
        if hasattr(client, "aio") and hasattr(client.aio, "models"):
            stream = client.aio.models.generate_content_stream(
                model=settings.GEMINI_LLM_MODEL,
                contents=prompt,
            )
            if inspect.isawaitable(stream):
                stream = await stream

            if hasattr(stream, "__aiter__"):
                async for chunk in stream:
                    txt = getattr(chunk, "text", "") or ""
                    if txt:
                        yield txt
                return
            elif hasattr(stream, "__iter__"):
                for chunk in stream:
                    txt = getattr(chunk, "text", "") or ""
                    if txt:
                        yield txt
                return

        # Fallback to sync client.models.generate_content_stream
        if hasattr(client, "models") and hasattr(client.models, "generate_content_stream"):
            sync_stream = client.models.generate_content_stream(
                model=settings.GEMINI_LLM_MODEL,
                contents=prompt,
            )
            for chunk in sync_stream:
                txt = getattr(chunk, "text", "") or ""
                if txt:
                    yield txt
            return

        # Fallback to regular non-streaming call
        res = client.models.generate_content(
            model=settings.GEMINI_LLM_MODEL,
            contents=prompt,
        )
        if res and res.text:
            yield res.text
        else:
            yield FALLBACK_INSUFFICIENT_INFO

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=502,
            detail=f"Failed to stream answer from Gemini model: {str(e)}",
        )


async def execute_rag_pipeline(
    db: AsyncSession,
    user_id: uuid.UUID,
    question: str,
    top_k: Optional[int] = None,
    similarity_threshold: Optional[float] = None,
) -> Tuple[str, List[SourceCitation], bool]:
    """
    Complete RAG pipeline:
    1. If user message is conversational greeting/acknowledgement, respond warmly without memory lookup.
    2. Embed user query with Gemini embeddings.
    3. Vector similarity search in PostgreSQL via pgvector.
    4. Generate grounded answer with Gemini LLM.
    """
    clean_q = question.strip()
    if is_conversational_acknowledgement(clean_q):
        conv_prompt = f"""You are the Human Legacy AI Assistant, dedicated to preserving and sharing a person's life memories and principles.
The user just sent a conversational remark or greeting: "{clean_q}".
Respond warmly, respectfully, and concisely in 1-2 friendly sentences, letting them know you are here whenever they would like to ask about or reflect on their memories. Do not invent any memories, cite sources, or return an insufficient info error."""
        answer, _ = await generate_grounded_answer(clean_q, citations=[], conversational_prompt=conv_prompt)
        return answer, [], True

    k = top_k or settings.RAG_TOP_K
    thresh = similarity_threshold if similarity_threshold is not None else settings.RAG_SIMILARITY_THRESHOLD

    # 1. Embed query
    query_emb = await generate_embedding(question)

    # 2. Vector search in pgvector
    citations = await search_relevant_chunks(
        db=db,
        user_id=user_id,
        query_embedding=query_emb,
        top_k=k,
        similarity_threshold=thresh,
    )

    # 3. Generate answer
    answer, is_grounded = await generate_grounded_answer(question, citations)

    return answer, citations, is_grounded

