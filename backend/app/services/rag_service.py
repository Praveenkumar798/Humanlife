"""
Human Legacy AI - RAG (Retrieval-Augmented Generation) Service

Executes semantic similarity search over stored pgvector embeddings,
constructs strict evidence-grounded prompts, and queries Gemini LLM
to generate source-cited answers without hallucination.
"""

import uuid
from typing import List, Tuple, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.config import settings
from app.models.memory import Memory
from app.models.chunk import MemoryChunk, SourceFile
from app.schemas.chat import SourceCitation
from app.services.embedding_service import generate_embedding, get_gemini_client

FALLBACK_INSUFFICIENT_INFO = "I could not find enough information in the stored memories to answer that."


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
) -> Tuple[str, bool]:
    """
    Query Gemini LLM with the grounded prompt.
    Returns: (answer_text, is_grounded)
    """
    # If no relevant chunks meet the threshold, return standard fallback immediately
    if not citations:
        return FALLBACK_INSUFFICIENT_INFO, False

    prompt = construct_rag_prompt(question, citations)
    client = get_gemini_client()

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_LLM_MODEL,
            contents=prompt,
        )

        answer = response.text.strip() if response and response.text else FALLBACK_INSUFFICIENT_INFO
        is_grounded = FALLBACK_INSUFFICIENT_INFO not in answer

        return answer, is_grounded

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate answer from Gemini model: {str(e)}",
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
    1. Embed user query with Gemini text-embedding-004
    2. Vector similarity search in PostgreSQL via pgvector
    3. Generate grounded answer with Gemini LLM
    """
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
