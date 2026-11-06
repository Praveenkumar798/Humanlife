# =============================================================================
# Human Legacy AI - Unified Production Dockerfile (for Render & Cloud Hosting)
# Builds React SPA frontend and serves directly alongside FastAPI backend
# =============================================================================

# Stage 1: Build React SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python Backend with FastAPI
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend/ .

# Copy built frontend assets from Stage 1 into /app/static for FastAPI to serve
COPY --from=frontend-builder /app/frontend/dist /app/static

RUN mkdir -p uploads
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
