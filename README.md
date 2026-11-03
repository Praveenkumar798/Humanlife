# 🧠 Human Legacy AI

**Personalized Memory Assistant** — Preserve personal memories, life experiences, values, and decision-making examples. Access them through an AI-powered chatbot with source citations and real-time voice conversation.

## Features (MVP)

- 🔐 **Secure Authentication** — JWT in httpOnly cookies
- 📝 **Memory Management** — Create, view, edit, delete personal memories
- 📄 **File Upload** — PDF and TXT upload with text extraction
- 🧩 **Smart Chunking** — Automatic text splitting for optimal retrieval
- 🔍 **Semantic Search** — Gemini embeddings with pgvector similarity search
- 🤖 **RAG Chatbot** — Evidence-grounded answers with source citations
- 💬 **Real-time Chat** — WebSocket-based streaming conversation
- 🎤 **Voice Assistant** — Gemini Live API with STT+TTS fallback
- 📊 **Conversation History** — Persistent chat sessions

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React.js + Vite |
| Backend | Python + FastAPI |
| Database | PostgreSQL + pgvector |
| AI | Google Gemini API |
| Voice | Gemini Live API |
| Deployment | Docker + Docker Compose |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Gemini API Key ([Get it here](https://aistudio.google.com/))

### 1. Clone and Configure

```bash
cd Humanlife
cp backend/.env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY
```

### 2. Start Database

```bash
docker compose up -d
```

### 3. Start Backend

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Open Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Project Structure

```
Humanlife/
├── backend/           # FastAPI backend
│   ├── app/           # Application code
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── routers/   # API routes
│   │   ├── services/  # Business logic
│   │   ├── middleware/ # Auth middleware
│   │   └── utils/     # Utilities
│   ├── alembic/       # Database migrations
│   ├── tests/         # Backend tests
│   └── uploads/       # Uploaded files
├── frontend/          # React frontend
├── docker-compose.yml # PostgreSQL + pgvector
└── README.md
```

## License

Private project — for personal and family use.

