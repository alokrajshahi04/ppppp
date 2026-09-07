-- Migration 002 · room membership (invites)
-- Shared rooms become invite-only; existing shared rooms are backfilled
-- with their workspace members so current audiences keep access.

CREATE TABLE IF NOT EXISTS task_members (
    task_id  UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_members_user ON task_members(user_id);

-- Backfill: every current workspace member of every SHARED room.
INSERT INTO task_members (task_id, user_id, added_by)
SELECT t.id, wm.user_id, t.driver_id
  FROM tasks t
  JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
 WHERE t.kind = 'SHARED'
ON CONFLICT DO NOTHING;
