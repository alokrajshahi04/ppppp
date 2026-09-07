# Development Guide

## Daily workflow

```bash
cp .env.example .env            # once
make up                         # build + start the stack
make test                       # 45-check E2E suite (scripts/api-test.sh)
docker compose build backend && docker compose up -d backend   # after backend edits
docker compose build frontend && docker compose up -d frontend # after frontend edits
docker compose build ai-engine && docker compose up -d ai-engine
make down / make clean          # stop / stop + wipe volumes
```

The Postgres schema and seed auto-apply **only on first boot of an empty volume**. After editing `postgres/init/*.sql` run `make clean && make up`.

## Running services outside Docker (fast iteration)

- Backend: `cd backend && npm run dev` (tsx watch; needs Postgres/MinIO reachable and env vars exported).
- Frontend: `cd frontend && npm run dev` (Vite on 3000, proxies `/api` + `/ws` to 3001).
- AI engine: `cd ai-engine && pip install -e . && uvicorn app.main:app --port 8000`.

## Layout conventions

| Path | Contents |
|---|---|
| `backend/src/<domain>/` | one folder per domain: `repo.ts` (SQL), `routes.ts` (HTTP) |
| `backend/src/internal/` | machine-to-machine routes (shared-secret auth, outside JWT scope) |
| `backend/src/rooms/` | WebSocket rooms, presence, in-process broadcaster |
| `contracts/src/` | all cross-boundary types; **both** apps import from here |
| `ai-engine/app/` | `routers/` (HTTP) · `agents/` (specialists) · `rag/` · `router/` · `verification/` · `storage/` |

## Hard-won integration notes (do not re-trip these)

1. **Fastify hook scope.** `app.addHook('preHandler', …)` on the root instance applies to *every* route in that scope — including ones registered earlier (health) and public ones (login). Every route group must register inside `app.register(async (scope) => …)` so hooks stay encapsulated. `authRoutes` is the exception: it uses per-route `{ preHandler: app.authenticate }` because login/refresh must stay public.
2. **`rootDir` drift.** Importing `@tolti/contracts` *source* into a `tsc` build drags `../contracts` into the program, shifting the inferred rootDir — output lands at `dist/backend/src/server.js` instead of `dist/server.js`. Solution: build contracts to `dist/` first and point tsconfig `paths` at `contracts/dist/index.d.ts` (`.d.ts` files don't affect rootDir). Docker builds compile contracts in a dedicated stage.
3. **MinIO presigned URLs.** Two different hostnames matter: the SDK's `MINIO_ENDPOINT` (`minio:9000`, container-internal) for credentialed operations, and `MINIO_PUBLIC_ENDPOINT` (`localhost:9000` on the host) embedded in presigned URLs the browser will open. The presign client must set `region: 'us-east-1'` — otherwise minio-js probes the bucket over the network against the *public* host from inside the container and dies on `::1:9000`.
4. **minio v8 presign ≠ pure-local.** See #3; verified empirically inside the container.
5. **Seed hash.** `postgres/init/03-seed.sql` contains a real bcrypt hash of `admin`. If login fails on an old volume, the volume predates the fix — wipe it.
6. **Non-UUID params.** `getTask`/`getEvidence` guard against non-UUID ids (Postgres would throw 500 instead of 404). Keep that pattern for new `:id` routes.
7. **AI engine port.** Host mapping is 18000 (8000 was taken by an unrelated local service); internal port stays 8000.

## Testing

- `scripts/api-test.sh [base_url]` — 45 checks across health, auth, RBAC denials, workspaces, tasks, messages, real MinIO uploads, AI-run lifecycle, approval gating, governance. Exit code = number of failures.
- Backend typecheck: `cd backend && npx tsc --noEmit`. Frontend: same in `frontend/`. Contracts build: `cd contracts && npm run build`.
- UI visual pass: Playwright scripts were used during development (screenshots of every page, desktop 1440×900 + mobile 390×844); re-run ad hoc as needed.

## Refactor log

| Change | Reason |
|---|---|
| Route groups wrapped in `app.register(...)` scopes | Hook leakage broke public routes (health 401) |
| `/internal/evidence/:id/ocr` moved to `src/internal/routes.ts` | Must not sit behind JWT; shared-secret auth instead |
| Duplicate `/v1/retrieve` router removed from AI engine | `evidence.router` already serves it; FastAPI first-registration masked the dupe |
| `MINIO_PUBLIC_ENDPOINT` split from `MINIO_ENDPOINT` | Presigned URLs must name a browser-reachable host |
| `listTasks` search filter rewritten with explicit param indices | `?` placeholder only replaced once, corrupting the query |
