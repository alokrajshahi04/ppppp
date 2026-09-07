# Architecture

Tolti AI is a three-tier, air-gapped system: a React SPA, a TypeScript application backend, and a Python AI engine. The browser only ever talks to the backend (directly in dev, through nginx in Docker). The backend is the single trust boundary — it owns auth, authorization, persistence, and all calls into the AI engine.

## Service responsibilities

### Frontend (`frontend/`, port 3000)
- React 18 + Vite + TypeScript, plain CSS design system (`src/styles.css`).
- In Docker, nginx serves the built SPA and reverse-proxies `/api/*` and `/ws/*` to the backend — the browser never needs CORS or direct service access.
- Dev mode: `vite` proxies the same paths to `localhost:3001`.

### Backend (`backend/`, port 3001)
- Fastify 5. One module per domain under `src/`: `auth`, `users`, `workspaces`, `tasks`, `evidence`, `messages`, `ai`, `approvals`, `governance`, `internal`, `rooms`.
- Each route group registers inside its **own encapsulated Fastify scope** (`app.register(...)`) so its `preHandler` JWT hook cannot leak onto sibling groups or `/health`. (Fastify applies `addHook` scope-wide; registration order does not protect earlier routes.)
- Owns: JWT sessions, RBAC enforcement, Postgres access (`pg`), MinIO SDK access, presigned URL minting, WebSocket rooms, audit logging, notifications.

### AI engine (`ai-engine/`, container port 8000, host 18000)
- FastAPI. Called **only** by the backend over the internal network.
- Components: `router/agent_router.py` (rule-based capability decision), `agents/` (OCR, vision, reason, code), `rag/` (chunker → indexer → pgvector retriever), `verification/` (citation extraction + claim verdict), `models/` (OpenAI-compatible adapter).
- Reads evidence blobs from MinIO and vectors from Postgres directly (read-side only).

### Data stores
- **Postgres 16 + pgvector** — all relational state plus `evidence_chunks.embedding vector(1536)` with an ivfflat cosine index. Schema auto-applies from `postgres/init/` on first container boot.
- **MinIO** — evidence blobs under `{taskId}/{uuid}.{ext}`. The bucket is private; all access flows through presigned URLs minted by the backend.

## Request lifecycles

### Evidence upload
1. `POST /api/v1/tasks/:id/evidence` → backend validates, records metadata, returns a **presigned PUT URL** (signed against `MINIO_PUBLIC_ENDPOINT`, the browser-reachable host).
2. Browser `PUT`s the file straight to MinIO — bytes never transit the backend.
3. Alternative path for restricted networks: `POST /api/v1/evidence/:id/upload-proxy` (multipart through the backend).
4. After upload, the backend triggers OCR in the AI engine, stores the extracted text, then triggers RAG indexing (chunk → embed → pgvector).

### AI run
1. `POST /api/v1/tasks/:id/ai/runs` → backend asks the Agent Router for a capability/model decision (pure rules; explicit `capability` in the request wins).
2. A row is created in `ai_runs` (`QUEUED`) and the event fans out to the task's WebSocket room.
3. The run executes asynchronously: optional pgvector retrieval → capability-specific agent call → `[cite:CHUNK_ID]` extraction → citation rows → `SUCCEEDED`/`FAILED`.
4. Without a wired model endpoint the upstream call fails and the run lands in `FAILED` with the error stored — visible in the UI, no silent hangs.

### Real-time collaboration
- `GET /ws/tasks/:id?token=<JWT>` — the backend verifies the token, loads initial state (task, messages, evidence, presence), joins the socket to the in-process room, and streams `hello:ok`.
- Events (see `contracts/src/ws.ts` for the authoritative shapes): `message:posted`, `evidence:uploaded`, `ai:started|progress|completed`, `approval:requested|decided`, `task:state`, `presence:update`, `ping`/`pong`.
- Rooms are an in-process `Map` (`rooms/broadcaster.ts`) — correct for single-node deployments; swap for Redis pub/sub when scaling out.

## Backend ⇄ AI engine internal API

All endpoints are `POST` under `/v1` (see `ai-engine/README.md`): `embed`, `ocr`, `vision`, `reason`, `code`, `route`, `verify`, `index/evidence`, `retrieve`. The backend→engine direction is plain HTTP on the compose network (`http://ai-engine:8000`).

The reverse direction (engine → backend) uses `POST /internal/evidence/:id/ocr` authenticated with the shared secret header `X-Internal-Token: $AI_ENGINE_SHARED_SECRET`. That route lives **outside** the JWT scope in `backend/src/internal/routes.ts`.

## Contracts

`contracts/src/` is the single source of truth for every cross-boundary type (REST payloads, WS envelopes, internal AI API). Both the backend and frontend import it via tsconfig `paths` pointing at `contracts/dist/index.d.ts`; the Docker builds compile contracts in a dedicated stage first. `contracts/openapi.yaml` mirrors the REST surface.

## Current limitations (by design, for now)

- Single-node WebSocket rooms (no Redis fanout yet).
- Agent Router is rule-based; no learned routing.
- No wired model endpoint — AI runs terminate `FAILED` until Wave 5.
- Presence rows persist per task; no janitor for stale entries.
