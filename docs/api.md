# API Reference (backend, port 3001)

Base path: `/api/v1` unless noted. Auth: `Authorization: Bearer <JWT>` unless marked **public**.
Full type definitions: `contracts/src/`. Machine-readable spec: `contracts/openapi.yaml`.

Error envelope (all non-2xx):

```json
{ "code": "UNAUTHORIZED", "message": "invalid or missing token", "details": null }
```

## System

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | public | `{status, version, services{database,object_store,ai_engine}, uptime_seconds}` |

## Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{email, password}` → `{user, access_token, refresh_token, expires_at}` |
| POST | `/auth/refresh` | public | `{refresh_token}` → new access token |
| POST | `/auth/logout` | public | revokes the refresh token |
| GET | `/auth/me` | JWT | current user incl. `system_roles` |
| POST | `/auth/change-password` | JWT | `{current_password, new_password}` |

Access tokens live 1 h; refresh tokens 7 d and are stored (revocable) in `sessions`.

## Users (ADMIN)

| Method | Path | Notes |
|---|---|---|
| GET | `/users` | admins get the directory; everyone else gets only themselves |
| POST | `/users` | `{email, display_name, password, system_roles[]}` |
| GET/PATCH/DELETE | `/users/:id` | PATCH updates name/active/roles; DELETE deactivates |

## Workspaces

| Method | Path | Notes |
|---|---|---|
| GET | `/workspaces` | workspaces the caller belongs to |
| POST | `/workspaces` | ADMIN only; creator becomes ADMIN member |
| GET/PATCH | `/workspaces/:id` | membership required; PATCH is ADMIN only |
| GET/POST | `/workspaces/:id/members` | add: ADMIN only, `{user_id, role}` |
| PATCH/DELETE | `/workspaces/:id/members/:userId` | ADMIN only |

## Tasks

| Method | Path | Notes |
|---|---|---|
| GET | `/tasks` | filters: `workspace_id, status, priority, driver_id, q, page, page_size`; `q` does ILIKE on title+description |
| POST | `/tasks` | `{workspace_id, title, description?, priority?}`; creator becomes driver |
| GET/PATCH/DELETE | `/tasks/:id` | DELETE archives (ADMIN or task driver) |
| POST | `/tasks/:id/handoff` | `{to_user_id, note?}` |

Status machine: `DRAFT → OPEN → IN_PROGRESS → AWAITING_APPROVAL → APPROVED | REJECTED → COMPLETED → ARCHIVED`.

## Evidence

| Method | Path | Notes |
|---|---|---|
| GET | `/tasks/:id/evidence` | list for a task |
| POST | `/tasks/:id/evidence` | `{kind, filename, mime_type, byte_size}` → `{evidence, upload_url, storage_key}`; `upload_url` is a presigned PUT (browser → MinIO directly) |
| GET | `/evidence/:id` | metadata incl. `ocr_text`, `ocr_completed` |
| GET | `/evidence/:id/download` | presigned GET URL |
| DELETE | `/evidence/:id` | uploader or ADMIN; removes blob + row |
| POST | `/evidence/:id/upload-proxy` | multipart fallback: `file=@...` through the backend |
| POST | `/internal/evidence/:id/ocr` | **internal token** (`X-Internal-Token`), called by the AI engine |

## Messages

| Method | Path | Notes |
|---|---|---|
| GET | `/tasks/:id/messages` | `?limit=&before=`; oldest-last ordering |
| POST | `/tasks/:id/messages` | `{content, kind?, attachments?, metadata?}` |

## AI runs

| Method | Path | Notes |
|---|---|---|
| GET | `/tasks/:id/ai/runs` | history for a task |
| POST | `/tasks/:id/ai/runs` | `{prompt, capability?, evidence_ids?, temperature?, max_tokens?}` → `202` with the queued run; execution continues in background |
| GET | `/ai/runs/:id` | run detail incl. citations |
| DELETE | `/ai/runs/:id` | cancel (requester only) |

## Approvals

| Method | Path | Notes |
|---|---|---|
| GET | `/approvals` | filters: `task_id, state, page, page_size` |
| POST | `/approvals` | `{task_id, kind, target_id?, summary, reason?}` |
| POST | `/approvals/:id/decide` | **SECURITY_APPROVER / ADMIN only**; `{decision: APPROVED|REJECTED, reason?}` |

## Governance

| Method | Path | Notes |
|---|---|---|
| GET | `/models` | all model configs |
| POST/PATCH/DELETE | `/models[/:id]` | ADMIN; one default per capability is enforced |
| GET | `/routing-policies` | list |
| POST/PATCH/DELETE | `/routing-policies[/:id]` | ADMIN |
| POST | `/routing-policies/:id/activate` | ADMIN; exactly one active policy |
| GET | `/audit` | ADMIN / SECURITY_APPROVER; filters `workspace_id, task_id, actor_id, event, from, to, page, page_size` |

## Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | `?unread=true` supported |
| POST | `/notifications/:id/read` | mark read |

## WebSocket

`GET /ws/tasks/:id?token=<JWT>` (not under `/api/v1`). First server frame is `hello:ok` carrying full initial state; subsequent frames are the event set in `contracts/src/ws.ts`. Client may send `ping`, `presence:update`, `message:post`, `typing`, `cursor:move`.

## Testing

`scripts/api-test.sh` exercises all of the above (45 checks) against a running stack:

```bash
./scripts/api-test.sh
```
