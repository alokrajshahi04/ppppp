# Tolti AI

**Sovereign, on-premise, air-gapped, multiplayer agentic AI workbench for confidential industrial work.**
SIH26117 · Smart Automation · Doc v1.0

> One task. Multiple trusted people. Multiple specialist AI capabilities. One shared source of truth. Zero required data egress.

---

## Status

| Wave | Scope | Status |
|---|---|---|
| 1 | Foundation — infra, DB schema, contracts, AI engine scaffold | ✅ complete |
| 2 | Backend — auth, RBAC, tasks, evidence, WS rooms, approvals, audit | ✅ complete |
| 3 | Frontend — workspace UI (rail, rooms with Chat/Documents/Code/Agent tabs, private + shared chats) | ✅ complete |
| 4 | Integration — **45/45 API checks green** · **full UI navigation pass clean** (no console errors, no 5xx) | ✅ complete |
| 5 | Model wiring (Ollama / vLLM endpoints) | ⏳ next |
| 6 | Deployment hardening (TLS, multi-node WS fanout, backups) | ⏳ |

**The full product loop works today**: sign in → pick a room (shared or private) → attach evidence (MinIO) → message the team → "Review & run" an AI request (routes through the Agent Router; fails gracefully into actionable error cards until a model endpoint is wired) → request approval → security sign-off → full audit trail. What is *not* wired yet is a real LLM endpoint — every model call returns a clean, retryable `FAILED` state instead of text.

---

## Architecture

```
┌────────────────────┐   HTTPS + WS    ┌───────────────────────┐
│  React + Vite UI   │ ◀─────────────▶ │  Fastify backend (TS)  │
│  nginx :3000       │                 │  :3001                 │
└────────────────────┘                 └──────┬─────────┬───────┘
                                              │         │
                                   internal AI API │  presigned S3
                                              ▼         ▼
                                  ┌────────────────┐  ┌─────────┐
                                  │ FastAPI engine │  │  MinIO  │
                                  │ :8000 (host    │  │  :9000  │
                                  │  maps 18000)   │  │  :9001  │
                                  └───────┬────────┘  └─────────┘
                                          │
                            ┌─────────────┼──────────────┐
                            ▼             ▼              ▼
                    pgvector :5432   OpenAI-compat    OCR / PDF
                    (PG 16 + vectors) model endpoints (local libs)
```

| Service | Container | Host port | Source |
|---|---|---|---|
| Frontend (React + nginx) | `tolti-frontend` | **3000** | `frontend/` |
| Backend (Fastify + TS) | `tolti-backend` | **3001** | `backend/` |
| AI engine (FastAPI + Python) | `tolti-ai-engine` | **18000** | `ai-engine/` |
| Postgres 16 + pgvector | `tolti-postgres` | 5432 | `postgres/init/` |
| MinIO (object store) | `tolti-minio` | 9000 / 9001 | — |

Note: the AI engine maps to **host port 18000** (8000 was occupied by an unrelated local service). Containers talk internally on 8000, so nothing else changes.

---

## Quickstart

Requirements: Docker with the compose plugin.

```bash
git clone <repo> && cd demo
cp .env.example .env          # then edit secrets (JWT_SECRET, MINIO_*, AI_ENGINE_SHARED_SECRET)
make up                       # builds + starts the whole stack
docker compose ps             # all five services should be up/healthy
```

Open **http://localhost:3000** and sign in.

### Seeded accounts (password `admin` for all — dev only)

| Email | Role |
|---|---|
| `admin@tolti.ai` | ADMIN |
| `driver@tolti.ai` | DRIVER |
| `reviewer@tolti.ai` | REVIEWER |
| `watcher@tolti.ai` | WATCHER |
| `security@tolti.ai` | SECURITY_APPROVER |

The seed also creates a **Default Workspace**, five **model configs** (OCR / VISION / TEXT / CODE / EMBEDDING pointing at a local OpenAI-compatible endpoint), and an active **routing policy**.

---

## Verification

### Automated API suite — 45 checks

```bash
./scripts/api-test.sh                      # against http://localhost:3001
./scripts/api-test.sh http://other-host    # custom target
```

Covers: health, auth (login/refresh/reject/me), RBAC denials, workspaces + membership, task CRUD + search + handoff, messages, **real evidence upload to MinIO** (presigned PUT, multipart proxy, presigned download), AI run lifecycle (202 → terminal state), approval gating (driver denied, security approver allowed), governance (models, policies, audit, notifications).

### Manual smoke

```bash
curl http://localhost:3001/health          # {"status":"ok", services all ok}
curl http://localhost:18000/health         # AI engine liveness
```

---

## Repository layout

```
demo/
├── frontend/          React 18 + Vite + TS · nginx-served, SPA + /api + /ws proxy
├── backend/           Fastify 5 + TS · auth, RBAC, rooms, evidence, governance
├── ai-engine/         FastAPI + Python · Agent Router, agents, RAG, verification
├── contracts/         Shared TS types + OpenAPI spec (single source of truth)
├── postgres/init/     01-extensions · 02-schema · 03-seed (auto-runs on first boot)
├── scripts/           api-test.sh (45-check E2E suite)
├── docs/              architecture · api · security · development
├── docker-compose.yml root-context builds; healthchecks; one network
└── Makefile           up / down / logs / shell-* / test
```

---

## Common operations

```bash
make logs            # tail everything
make down            # stop (keeps data)
make clean           # stop + DELETE volumes (fresh DB on next boot)
make test            # run the 45-check API suite
make shell-db        # psql
make shell-backend   # sh in backend
make shell-ai        # bash in AI engine
```

Rebuild one service after editing its source:

```bash
docker compose build backend && docker compose up -d backend
```

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `permission denied` on docker | `sudo usermod -aG docker $USER && newgrp docker` |
| Port 8000 in use | AI engine already remapped to **18000**; change `AI_ENGINE_PORT` in `.env` |
| MinIO container restart-loop | `MINIO_ROOT_PASSWORD` must be ≥ 8 chars |
| Login fails with correct password | Stale DB volume seeded before a seed fix → `make clean && make up` |
| Presigned URLs unreachable from browser | `MINIO_PUBLIC_ENDPOINT` must be the host-reachable address (`localhost:9000` locally) |

---

## Documentation

| Doc | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Services, data flow, WS protocol, AI internal API |
| [docs/api.md](docs/api.md) | Endpoint reference, auth, error format |
| [docs/security.md](docs/security.md) | RBAC matrix, JWT lifecycle, internal tokens, audit |
| [docs/development.md](docs/development.md) | Local dev, rebuild flows, conventions, refactor log |

## License / classification

Internal sovereign deployment. No data leaves the deployment boundary by design.
