# Tolti AI - Tech Book

**What it is:** a multiplayer agentic AI workbench where one task, multiple trusted people, and multiple specialist AI agents share one room, one evidence trail, and one audit log - built for confidential industrial work (SIH26117 · Smart Automation).

---

## 1. The stack and why each piece was chosen

| Layer | Tech | Why we chose it (the one-line defence) |
|---|---|---|
| Frontend | **React 18 + TypeScript + Vite**, served by **nginx** | Component model fits a tabbed, real-time workspace; Vite gives instant rebuilds during a hackathon; TS catches contract breakage at compile time. |
| Realtime | **WebSockets** (`@fastify/websocket`), per-room connections | Multiplayer is the product: chat, presence, AI-run progress, handoffs and approvals must appear live for everyone in the room without polling. |
| Backend API | **Fastify 5 + TypeScript + Zod** | Fast, schema-first (Zod validates every request body), and its plugin model maps 1:1 to our modules (auth, rooms, evidence, approvals, governance). |
| Auth / RBAC | **JWT** (`@fastify/jwt`) + bcrypt + role guards | Roles (ADMIN / DRIVER / REVIEWER / WATCHER / SECURITY_APPROVER) are enforced at the route layer, not the UI - the UI only reflects what the API already decided. |
| Database | **PostgreSQL 16 + pgvector** | One database for relational data (users, rooms, approvals, audit) *and* vector embeddings - no separate vector DB to run or sync in an air-gapped deployment. |
| Object store | **MinIO** (S3 API) + presigned URLs | Evidence (PDFs, photos) stays on-premise; the browser uploads/downloads directly via presigned PUT/GET so files never pass through the API server. |
| AI engine | **Python + FastAPI** (separate service) | Python owns the AI ecosystem (OCR, embeddings, agents). Kept as its own service so models can scale/redeploy independently of the API, and so a GPU host change is config, not code. |
| Model serving | **vLLM on Modal.com GPUs** (A-series/L-class) | Our laptop could not host 7–8B models locally, so we rent GPUs per-second on Modal and serve **OpenAI-compatible** endpoints. Because every agent already speaks the OpenAI adapter, pointing `model_configs.base_url` at Modal was a config change, not a rewrite. Scales to zero when idle (≈$0 idle; demo bursts fit in free credits). |
| Contracts | **Shared TS package (`@tolti/contracts`) + OpenAPI** | One source of truth for types across frontend/backend - the reason our 45-check API suite and the UI agree. |
| Infra | **Docker Compose** (5 services, one network, healthchecks) | Judges/teammates run the whole product with `make up`. |
| Text extraction | **Tesseract (pytesseract) + pdfplumber + Pillow** | Fully local OCR for scanned PDFs/images - no cloud OCR, keeping the air-gap story intact. |

## 2. The functions that do the real work

| Function / class | Where | What it does |
|---|---|---|
| `AgentRouter.decide()` | `ai-engine/app/router/agent_router.py` | Reads the run request + routing policy and picks the capability (OCR / VISION / TEXT / CODE / EMBEDDING) and model - the "multiplayer AI" traffic controller. |
| `BaseAgent.run()` + `code_agent / ocr_agent / reason_agent / vision_agent` | `ai-engine/app/agents/` | One agent per capability; each renders prompts, calls the OpenAI-compatible endpoint, returns structured output. |
| `Indexer.index()` / `Retriever.retrieve()` / `chunk_text()` | `ai-engine/app/rag/` | Chunks uploaded evidence, embeds into pgvector, retrieves top-k chunks with citations - answers are grounded in the room's own documents. |
| `Verifier.verify()` / `citations.py` | `ai-engine/app/verification/` | Cross-checks the model's answer against retrieved quotes and attaches per-citation confidence - the anti-hallucination step. |
| Automations: `email_summary`, `export_report`, `followup_task` | `ai-engine/app/automations/` | Agentic actions that operate on the room (draft email, export report, spawn follow-up task) - triggered by button or by plain chat ("export a report"). |
| `presign` evidence flow | `backend/src/evidence/` | Presigned MinIO upload → OCR + indexing pipeline (`/evidence/:id/complete`). |
| WS room broadcaster | `backend/src/rooms/` | Fans out `message:posted`, `ai:started/progress/completed`, `approval:*`, `presence:update` events to every member in the room. |
| `Composer` (Team ⇄ Ask AI) | `frontend/src/pages/Room.tsx` | One input: send to the humans or run the AI (⌘↵ always runs AI); auto-targets the code model when the Code tab is open. |
| `Hand off` (driver transfer) | room footer | Live control transfer - anyone in the room can become the driver; presence and UI update for all in real time. |

## 3. The Modal GPU story (say this to judges)

The product is designed for **on-premise, air-gapped** deployment (local Ollama/vLLM endpoints - the default config points there). For the hackathon demo our laptop lacked the VRAM to host 7–8B models, so we deployed **vLLM servers on Modal.com rented GPUs** and pointed the existing `model_configs` at those OpenAI-compatible URLs. Same code, same agents, same adapter - only `base_url` changed. This proves the architecture: **the deployment target is a dropdown, not a fork.**

## 4. Verified working today

- **58/58 automated API checks** green (auth, RBAC denials, evidence upload to MinIO, AI run lifecycle, approval gating, governance).
- Full UI loop: sign in → room → attach evidence → chat → run AI (real model answers with citations) → request approval → security sign-off → audit trail.
- Multiplayer live: two browsers in one room see each other's messages, presence, AI runs and handoffs instantly.
