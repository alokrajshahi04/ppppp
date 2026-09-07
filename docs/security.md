# Security Model

Tolti is built for confidential industrial work on air-gapped networks. The security posture is deny-by-default, fully audited, and single-trust-boundary.

## Trust boundary

The browser talks **only** to the backend (HTTP + WS). It never receives database or object-store credentials. The AI engine is network-isolated on the compose network and reachable only from the backend (and, for presigned flows, only as a URL host — see below). On the host, only mapped ports are exposed; the AI engine's host mapping (18000) is a debug convenience and can be removed in hardened deployments.

## Authentication

- **Login** verifies bcrypt password hashes (cost 10) and returns a 1-hour JWT (sub, email, system_roles) plus a 7-day refresh token.
- Refresh tokens are persisted in `sessions` with IP + user-agent, and are **revocable** (logout) and single-purpose.
- WebSocket connections authenticate via `?token=<JWT>` at upgrade time (browsers cannot set headers on WS).
- Failed logins and logouts are audit-logged with IP and user-agent.

## Authorization (RBAC)

System roles live in `user_system_roles`; workspace-scoped membership in `workspace_members`. Every route requires membership; most also require a permission from the matrix in `backend/src/rbac/permissions.ts`:

| Capability | ADMIN | DRIVER | REVIEWER | WATCHER | SECURITY_APPROVER |
|---|---|---|---|---|---|
| Manage users / models / policies | ✅ | — | — | — | — |
| Read audit log | ✅ | — | — | — | ✅ |
| Create / update / hand off tasks | ✅ | ✅ | update + handoff | — | — |
| Upload / delete evidence | ✅ | ✅ | read | read | read |
| Post messages | ✅ | ✅ | ✅ | read-only | read-only |
| Start / cancel AI runs | ✅ | ✅ | start | read-only | read-only |
| Request approval | ✅ | ✅ | ✅ | — | — |
| **Decide approvals** | ✅ | — | — | — | ✅ |

Enforcement is layered: the role matrix denies first, then workspace-membership checks, then resource ownership (e.g. only the uploader or an ADMIN may delete evidence; only a run's requester may cancel it). Denied actions are tested in the E2E suite (driver → `/audit` = 403, driver → approval decide = 403).

## Human-in-the-loop gating

Sensitive outputs (`OUTPUT`, `ACTION`, `REPORT`, `SENSITIVE_FINDING`) require an `approvals` row in `PENDING` state. Only `SECURITY_APPROVER` or `ADMIN` may transition it. Every request and decision is audit-logged with reason.

## Machine-to-machine auth

Engine → backend callbacks use the `X-Internal-Token` header checked against `AI_ENGINE_SHARED_SECRET`. If the secret is unset the endpoint denies everything (fail closed). This route is intentionally outside the JWT scope.

## Object storage

- The `evidence` bucket is private (`mc anonymous set none` at init).
- Browser uploads/downloads use **presigned URLs** (1 h TTL) signed for `MINIO_PUBLIC_ENDPOINT`.
- Server-side SDK operations always use the internal endpoint (`MINIO_ENDPOINT=minio:9000`); public hostnames are never used for credentialed calls.

## Audit

`audit_logs` is append-only (no UPDATE/DELETE paths exist in code) and records: actor, workspace, task, event kind, target, JSON payload, IP, user-agent, timestamp. 27 event kinds cover auth, membership, tasks, evidence, AI runs, approvals, and configuration changes. Queryable via `/api/v1/audit` (ADMIN / SECURITY_APPROVER).

Additionally, `session_events` stores ordered per-task events intended for **session replay** (watcher/auditor reconstruction of a task's history).

## Secrets handling

- All secrets flow through env (`/.env`, git-ignored; `.env.example` documents them).
- `JWT_SECRET`, `MINIO_ROOT_PASSWORD`, `AI_ENGINE_SHARED_SECRET` must be rotated per deployment; defaults in `.env.example` are for local dev only.
- Seeded demo users share the password `admin` — the seed is for development only and must not run in production.

## Known gaps (Wave 6 candidates)

- No TLS termination inside the stack (terminate at a reverse proxy in front of nginx).
- Single-node WS rooms; no Redis auth fanout.
- No password complexity policy beyond minimum length; no rate limiting on login.
- Audit log retention/partitioning not yet configured.
