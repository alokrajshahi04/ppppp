-- Tolti AI · Core schema
-- All tables, indexes, and constraints for the sovereign multiplayer AI workbench.

SET client_min_messages = WARNING;

-- ════════════════════════════════════════════════════════════════
--  ENUMS
-- ════════════════════════════════════════════════════════════════

CREATE TYPE user_role AS ENUM (
    'ADMIN',
    'DRIVER',
    'REVIEWER',
    'WATCHER',
    'SECURITY_APPROVER'
);

CREATE TYPE task_status AS ENUM (
    'DRAFT',
    'OPEN',
    'IN_PROGRESS',
    'AWAITING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'COMPLETED',
    'ARCHIVED'
);

CREATE TYPE task_priority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- SHARED rooms are visible to every workspace member.
-- PRIVATE rooms are visible only to their driver (and ADMIN).
CREATE TYPE task_kind AS ENUM (
    'SHARED',
    'PRIVATE'
);

CREATE TYPE evidence_kind AS ENUM (
    'PDF',
    'IMAGE',
    'DIAGRAM',
    'TEXT',
    'CODE',
    'OTHER'
);

CREATE TYPE ai_run_status AS ENUM (
    'QUEUED',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE approval_state AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'REVOKED'
);

CREATE TYPE approval_kind AS ENUM (
    'OUTPUT',
    'ACTION',
    'REPORT',
    'SENSITIVE_FINDING'
);

CREATE TYPE model_capability AS ENUM (
    'OCR',
    'VISION',
    'TEXT',
    'CODE',
    'EMBEDDING',
    'AUTOMATION'
);

CREATE TYPE audit_event_kind AS ENUM (
    'USER_LOGIN',
    'USER_LOGOUT',
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'ROLE_CHANGED',
    'WORKSPACE_CREATED',
    'WORKSPACE_UPDATED',
    'MEMBER_ADDED',
    'MEMBER_REMOVED',
    'TASK_CREATED',
    'TASK_UPDATED',
    'TASK_HANDED_OFF',
    'TASK_ARCHIVED',
    'EVIDENCE_UPLOADED',
    'EVIDENCE_DELETED',
    'EVIDENCE_REINDEXED',
    'AI_RUN_STARTED',
    'AI_RUN_COMPLETED',
    'AI_RUN_FAILED',
    'AI_OUTPUT_GENERATED',
    'APPROVAL_REQUESTED',
    'APPROVAL_GRANTED',
    'APPROVAL_REJECTED',
    'REPORT_GENERATED',
    'POLICY_CHANGED',
    'MODEL_CONFIG_CHANGED',
    'STORAGE_CONFIG_CHANGED'
);

CREATE TYPE message_kind AS ENUM (
    'USER',
    'AI',
    'SYSTEM',
    'COMMENT'
);

CREATE TYPE presence_status AS ENUM (
    'ONLINE',
    'IDLE',
    'OFFLINE'
);

-- ════════════════════════════════════════════════════════════════
--  USERS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- A user's *system* role (ADMIN/DRIVER/etc.). Workspace membership
-- scopes that role to a specific workspace (member role below).
CREATE TABLE user_system_roles (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         user_role NOT NULL,
    granted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by   UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role)
);

-- ════════════════════════════════════════════════════════════════
--  WORKSPACES
-- ════════════════════════════════════════════════════════════════

CREATE TABLE workspaces (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         user_role NOT NULL,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- ════════════════════════════════════════════════════════════════
--  TASKS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE tasks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT,
    status        task_status NOT NULL DEFAULT 'DRAFT',
    priority      task_priority NOT NULL DEFAULT 'MEDIUM',
    kind          task_kind NOT NULL DEFAULT 'SHARED',
    driver_id     UUID NOT NULL REFERENCES users(id),
    handed_off_to UUID REFERENCES users(id),
    parent_task_id UUID REFERENCES tasks(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_driver ON tasks(driver_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- ════════════════════════════════════════════════════════════════
--  TASK (ROOM) MEMBERSHIP
--  Shared rooms are visible only to invited workspace members.
--  The driver is an implicit member. PRIVATE rooms have no members
--  (driver-only). Workspace ADMINs retain audit visibility.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE task_members (
    task_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by  UUID REFERENCES users(id),
    added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Room-level role on top of workspace roles: DRIVER owns the room,
    -- REVIEWER reviews/approves AI work, WATCHER observes, MEMBER collaborates.
    room_role TEXT NOT NULL DEFAULT 'MEMBER',
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_task_members_user ON task_members(user_id);

-- ════════════════════════════════════════════════════════════════
--  EVIDENCE  (uploaded files / metadata; blob lives in MinIO)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE evidence (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by   UUID NOT NULL REFERENCES users(id),
    kind          evidence_kind NOT NULL,
    filename      TEXT NOT NULL,
    mime_type     TEXT NOT NULL,
    byte_size     BIGINT NOT NULL,
    storage_key   TEXT NOT NULL,
    checksum_sha256 TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    ocr_text      TEXT,
    ocr_completed BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_task ON evidence(task_id);

-- Vector chunks for evidence retrieval (RAG).
-- Each chunk is a slice of OCR text or extracted document text.
CREATE TABLE evidence_chunks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(768),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_chunks_evidence ON evidence_chunks(evidence_id);
CREATE INDEX idx_evidence_chunks_embedding ON evidence_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ════════════════════════════════════════════════════════════════
--  AI RUNS  (one row per agent invocation)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE ai_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    triggered_by    UUID NOT NULL REFERENCES users(id),
    capability      model_capability NOT NULL,
    model_id        TEXT NOT NULL,
    prompt          TEXT NOT NULL,
    response        TEXT,
    status          ai_run_status NOT NULL DEFAULT 'QUEUED',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error           TEXT,
    token_usage     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_runs_task ON ai_runs(task_id);
CREATE INDEX idx_ai_runs_status ON ai_runs(status);

-- Citations: link AI claim -> originating evidence chunk.
CREATE TABLE citations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ai_run_id       UUID NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
    chunk_id        UUID REFERENCES evidence_chunks(id) ON DELETE SET NULL,
    evidence_id     UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    quote           TEXT NOT NULL,
    confidence      REAL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_citations_run ON citations(ai_run_id);
CREATE INDEX idx_citations_evidence ON citations(evidence_id);

-- ════════════════════════════════════════════════════════════════
--  MESSAGES  (chat / conversation)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    sender_id   UUID REFERENCES users(id),
    kind        message_kind NOT NULL,
    content     TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_task ON messages(task_id, created_at);

-- ════════════════════════════════════════════════════════════════
--  PRESENCE  (real-time collaboration)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE presence (
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      presence_status NOT NULL DEFAULT 'ONLINE',
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cursor      JSONB,
    PRIMARY KEY (task_id, user_id)
);

-- ════════════════════════════════════════════════════════════════
--  APPROVALS  (human-in-the-loop gates)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE approvals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    requested_by    UUID NOT NULL REFERENCES users(id),
    decided_by      UUID REFERENCES users(id),
    kind            approval_kind NOT NULL,
    target_id       UUID,
    summary         TEXT NOT NULL,
    reason          TEXT,
    state           approval_state NOT NULL DEFAULT 'PENDING',
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at      TIMESTAMPTZ
);

CREATE INDEX idx_approvals_task ON approvals(task_id);
CREATE INDEX idx_approvals_state ON approvals(state);

-- ════════════════════════════════════════════════════════════════
--  AUDIT LOG  (append-only, complete history)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID REFERENCES users(id),
    workspace_id UUID REFERENCES workspaces(id),
    task_id     UUID REFERENCES tasks(id),
    event       audit_event_kind NOT NULL,
    target_type TEXT,
    target_id   TEXT,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_audit_task ON audit_logs(task_id);
CREATE INDEX idx_audit_event ON audit_logs(event);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ════════════════════════════════════════════════════════════════
--  MODEL CONFIGURATION  (admin-managed AI endpoints)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE model_configs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capability  model_capability NOT NULL,
    name        TEXT NOT NULL,
    provider    TEXT NOT NULL,
    base_url    TEXT NOT NULL,
    api_key     TEXT,
    model_id    TEXT NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_model_default_per_cap ON model_configs(capability) WHERE is_default = TRUE;

-- ════════════════════════════════════════════════════════════════
--  ROUTING POLICY  (rules that decide which model/agent handles a task)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE routing_policies (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,
    rules       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
--  SESSIONS  (JWT refresh / session replay)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL UNIQUE,
    ip_address  INET,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Session replay: store ordered events for a task so watchers / auditors
-- can replay the entire collaboration after the fact.
CREATE TABLE session_events (
    id          BIGSERIAL PRIMARY KEY,
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES users(id),
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_events_task ON session_events(task_id, created_at);

-- ════════════════════════════════════════════════════════════════
--  NOTIFICATIONS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id),
    task_id     UUID REFERENCES tasks(id),
    kind        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- ════════════════════════════════════════════════════════════════
--  TRIGGERS  (updated_at maintenance)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_workspaces_updated_at    BEFORE UPDATE ON workspaces    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at         BEFORE UPDATE ON tasks         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_model_configs_updated_at BEFORE UPDATE ON model_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_routing_policies_updated_at BEFORE UPDATE ON routing_policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
