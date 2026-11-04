# 🧠 Human Legacy AI — Personalized Memory Assistant

**Human Legacy AI** is an evidence-grounded AI memory preservation assistant that captures, organizes, and shares a person's life memories, experiences, principles, values, and decision-making history. Powered by Retrieval-Augmented Generation (RAG) with Google Gemini LLM, pgvector vector storage, and a dual conversational interface (Real-time Token Streaming & Gemini Live Voice Assistant).

---

## 🌟 Architecture & Completed Stages (1 to 11)

| Stage | Milestone | Status | Key Components |
|---|---|---|---|
| **Stage 1** | Blueprint & Architecture Analysis | ✅ Complete | Gap analysis, data modeling, 18-month plan to MVP roadmap |
| **Stage 2** | Backend Foundation & DB Models | ✅ Complete | FastAPI, SQLAlchemy 2.0 Async, PostgreSQL 16 + pgvector, Alembic |
| **Stage 3** | Authentication & Security Perimeter | ✅ Complete | Native bcrypt hashing, JWT access tokens, secure httpOnly cookies |
| **Stage 4** | Memory Management CRUD | ✅ Complete | User ownership isolation, pagination, search, categorization |
| **Stage 5** | Ingestion, Extraction & Vectors | ✅ Complete | `pypdfium2` PDF extractor, text chunking, Gemini `text-embedding-004` (768d) |
| **Stage 6** | RAG Retrieval & Grounded Chatbot | ✅ Complete | pgvector cosine distance (`<=>`), anti-hallucination prompt, citation chips |
| **Stage 7** | Modern React SPA Frontend | ✅ Complete | Vite + React, Tailwind styling, 10 responsive pages, cookie credentials |
| **Stage 8** | WebSocket Real-Time Chat Streaming | ✅ Complete | `/ws/chat`, token-by-token streaming, live typing cursor |
| **Stage 9** | Gemini Live API Voice Connection | ✅ Complete | `/ws/voice-live`, bidirectional 16kHz mic PCM streaming, 24kHz synthesized audio |
| **Stage 10** | STT + RAG + TTS Voice Fallback | ✅ Complete | Multi-tiered fallback (`/api/voice/query`), hybrid Web Audio + SpeechSynthesis |
| **Stage 11** | End-to-End Integration & Docker | ✅ Complete | 66 passing backend tests, production Docker Compose multi-container stack |

---

## 🚀 Quick Start (Local Docker Compose)

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- [Google Gemini API Key](https://aistudio.google.com/) (Free tier available).

### 2. Configure Environment
```bash
# Copy example environment configuration
cp .env.example .env

# Edit .env and paste your Gemini API Key
# GEMINI_API_KEY=your_actual_key_here
```

### 3. Launch Full Stack
Run one single command:
```bash
docker compose up --build -d
```

Containers launched:
- **Frontend SPA:** [http://localhost:3000](http://localhost:3000) (Nginx + React)
- **FastAPI Backend:** [http://localhost:8000](http://localhost:8000)
- **Interactive API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL Vector DB:** `localhost:5432` (`pgvector/pgvector:pg16`)

---

## 💻 Manual Local Development (Without Docker)

### 1. Start Vector Database
```bash
docker compose up postgres -d
```

### 2. Start Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # On Windows (or source venv/bin/activate on Linux/Mac)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Automated Test Suite (66 Tests)

Run the full backend test suite:
```bash
cd backend
python -m pytest -v
```

Verified test coverage across all subsystems:
- `test_auth.py` (11 tests): Password hashing, JWT lifecycle, secure cookies, registration, login, logout.
- `test_health.py` (4 tests): Service health, readiness, and offline fallback degradation.
- `test_memories.py` (8 tests): Memory CRUD, ownership isolation, filtering, auto-chunk indexing.
- `test_models.py` (5 tests): SQLAlchemy models, relationships, and metadata validation.
- `test_rag.py` (7 tests): pgvector similarity search, prompt construction, grounding checks, citations.
- `test_uploads.py` (9 tests): PDF/TXT text extraction, chunking sliding window, batch embeddings.
- `test_websocket_chat.py` (6 tests): Handshake auth, ping/pong, real-time token streaming.
- `test_websocket_voice.py` (7 tests): Voice handshake, Gemini Live config, audio/transcript flow, fallback signaling.
- `test_voice_fallback.py` (8 tests): STT transcription, TTS synthesis, query pipeline, fallback endpoints.
- `test_e2e_integration.py` (1 test): Complete 13-step end-to-end user journey simulation.

---

## 🔒 Security & Privacy Guarantees

1. **Anti-Hallucination & Grounding:** Gemini responds using strictly retrieved excerpts from the user's documented memories. If facts are missing, the assistant returns verbatim:
   *"I could not find enough information in the stored memories to answer that."*
2. **Cookie-Based Security:** Authentication tokens reside strictly inside `httpOnly`, `SameSite=Lax` cookies, preventing JavaScript XSS token extraction.
3. **Multi-Tenant Isolation:** All database queries, vector similarity lookups, file processing, and chat sessions enforce strict `user_id` filtering.
4. **Session-Bound Audio:** Microphone permissions are requested solely when recording is active and terminate immediately when stopped.
