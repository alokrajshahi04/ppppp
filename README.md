# Tolti AI · root

A sovereign, on-premise, air-gapped, multiplayer agentic AI workbench for confidential industrial work.

## Architecture

```
┌────────────────────┐      HTTPS      ┌──────────────────────┐
│  React + Vite UI   │ ◀────────────▶  │  Fastify backend (TS) │
│  (port 3000)       │   WebSocket     │  (port 3001)         │
└────────────────────┘                 └──────────┬───────────┘
                                                   │
                                          Internal AI API (HTTP)
                                                   │
                                                   ▼
                                       ┌──────────────────────┐
                                       │  FastAPI AI engine   │
                                       │  (port 8000)         │
                                       └──────────┬───────────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          ▼                       ▼                       ▼
                  PostgreSQL+pgvector        MinIO (S3)          OpenAI-compatible
                  (port 5432)               (ports 9000/9001)   model endpoints
                                                                   (Ollama, vLLM, …)
```

## Services

| Service      | Port | Tech                | Role |
|--------------|------|---------------------|------|
| `frontend`   | 3000 | React + Vite + TS   | UI |
| `backend`    | 3001 | Fastify + TS        | Auth, RBAC, rooms, API gateway |
| `ai-engine`  | 8000 | FastAPI + Python    | Agent Router, OCR, vision, RAG, verification |
| `postgres`   | 5432 | pgvector/pgvector   | Persistence + vector search |
| `minio`      | 9000 / 9001 | MinIO        | Object storage for evidence |

## Quickstart

```bash
cp .env.example .env
make up           # bring up the full stack
make logs         # tail logs
make shell-db     # psql
```

Seed users (password `admin` for all, change immediately):

| Email | Role |
|---|---|
| `admin@tolti.ai`    | ADMIN |
| `driver@tolti.ai`   | DRIVER |
| `reviewer@tolti.ai` | REVIEWER |
| `watcher@tolti.ai`  | WATCHER |
| `security@tolti.ai` | SECURITY_APPROVER |

## Layout

```
demo/
├── frontend/        React + Vite + TypeScript
├── backend/         Fastify + TypeScript (auth, RBAC, websocket, API)
├── ai-engine/       FastAPI + Python (Agent Router, agents, RAG)
├── postgres/init/   Schema + seed SQL
├── contracts/       Shared TS types + OpenAPI spec (single source of truth)
├── docs/            Architecture notes
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Build status

| Wave | Status |
|---|---|
| 0 — Foundation (infra, schema, contracts, AI scaffold) | ✅ done |
| 1 — Backend + AI engine implementations | ⏳ next |
| 2 — Frontend screens | ⏳ |
| 3 — Integration, testing, polish | ⏳ |
