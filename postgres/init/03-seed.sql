-- Tolti AI · Seed data for development
-- Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────
--  Default admin user
--  password: "admin" (bcrypt hash, cost 10) — CHANGE IN PROD
-- ─────────────────────────────────────────────────────────────

INSERT INTO users (id, email, display_name, password_hash)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@tolti.ai',
    'Sovereign Admin',
    '$2a$10$UkDE7OtV18Pg8PlRUMp1RuggZNnbCzERcxgy/WTj4iURPnp1FtEiq'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO user_system_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'ADMIN')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
--  Demo driver / reviewer / watcher / security approver
-- ─────────────────────────────────────────────────────────────

INSERT INTO users (id, email, display_name, password_hash) VALUES
    ('00000000-0000-0000-0000-000000000002', 'driver@tolti.ai',     'Driver Demo',    '$2a$10$UkDE7OtV18Pg8PlRUMp1RuggZNnbCzERcxgy/WTj4iURPnp1FtEiq'),
    ('00000000-0000-0000-0000-000000000003', 'reviewer@tolti.ai',   'Reviewer Demo',  '$2a$10$UkDE7OtV18Pg8PlRUMp1RuggZNnbCzERcxgy/WTj4iURPnp1FtEiq'),
    ('00000000-0000-0000-0000-000000000004', 'watcher@tolti.ai',    'Watcher Demo',   '$2a$10$UkDE7OtV18Pg8PlRUMp1RuggZNnbCzERcxgy/WTj4iURPnp1FtEiq'),
    ('00000000-0000-0000-0000-000000000005', 'security@tolti.ai',   'Security Demo',  '$2a$10$UkDE7OtV18Pg8PlRUMp1RuggZNnbCzERcxgy/WTj4iURPnp1FtEiq')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_system_roles (user_id, role) VALUES
    ('00000000-0000-0000-0000-000000000002', 'DRIVER'),
    ('00000000-0000-0000-0000-000000000003', 'REVIEWER'),
    ('00000000-0000-0000-0000-000000000004', 'WATCHER'),
    ('00000000-0000-0000-0000-000000000005', 'SECURITY_APPROVER')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
--  Default workspace
-- ─────────────────────────────────────────────────────────────

INSERT INTO workspaces (id, name, slug, description, created_by)
VALUES (
    '00000000-0000-0000-0000-0000000000aa',
    'Default Workspace',
    'default',
    'Sovereign workspace seeded for local development.',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (slug) DO NOTHING;

-- Two extra demo workspaces so the switcher has real options
INSERT INTO workspaces (id, name, slug, description, created_by) VALUES
    ('00000000-0000-0000-0000-0000000000ab', 'Maintenance Ops', 'maintenance-ops',
     'Field maintenance investigations and equipment history.', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-0000000000ac', 'Process Safety', 'process-safety',
     'Safety reviews, HAZOP follow-ups and compliance notes.', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000002', 'DRIVER'),
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000003', 'REVIEWER'),
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000004', 'WATCHER'),
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000005', 'SECURITY_APPROVER'),
    ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-000000000001', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-000000000002', 'DRIVER'),
    ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-000000000003', 'REVIEWER'),
    ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-000000000004', 'WATCHER'),
    ('00000000-0000-0000-0000-0000000000ac', '00000000-0000-0000-0000-000000000001', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000ac', '00000000-0000-0000-0000-000000000002', 'DRIVER'),
    ('00000000-0000-0000-0000-0000000000ac', '00000000-0000-0000-0000-000000000005', 'SECURITY_APPROVER')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
--  Demo rooms + a little activity so the workspace feels alive
-- ─────────────────────────────────────────────────────────────

INSERT INTO tasks (id, workspace_id, title, description, status, priority, kind, driver_id) VALUES
    ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000aa',
     'Pump 7 vibration anomaly', 'Investigate repeated bearing failures on line 7.',
     'IN_PROGRESS', 'HIGH', 'SHARED', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000aa',
     'Bearing lubrication schedule review', 'Compare the 500h interval against vendor guidance.',
     'OPEN', 'MEDIUM', 'SHARED', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000000aa',
     'Compressor outage RCA', 'Root-cause analysis for the Q2 outage. Awaiting security sign-off.',
     'AWAITING_APPROVAL', 'CRITICAL', 'SHARED', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-0000000000ab',
     'Conveyor belt alignment check', 'Track misalignment reported by night shift.',
     'OPEN', 'LOW', 'SHARED', '00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-0000000000aa',
     'Audit prep checklist', 'Private working notes for the quarterly audit.',
     'OPEN', 'MEDIUM', 'PRIVATE', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (task_id, sender_id, kind, content) VALUES
    ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000002', 'USER',
     'Bearing temp spiked to 92°C overnight — rating is 80°C max. Attaching the sensor log.'),
    ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-000000000003', 'USER',
     'I''ll review the final note once the evidence is attached.'),
    ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-000000000005', 'USER',
     'Holding approval until the RCA draft cites the trip logs.')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
--  Default model configs (point at local Ollama / OpenAI-compatible)
-- ─────────────────────────────────────────────────────────────

INSERT INTO model_configs (capability, name, provider, base_url, model_id, is_default, settings) VALUES
    ('OCR',       'Local OCR (Surya)',    'openai-compatible', 'http://host.docker.internal:11434/v1', 'llama3.2-vision', TRUE,  '{"temperature": 0}'),
    ('VISION',    'Local Vision (LLaVA)',  'openai-compatible', 'http://host.docker.internal:11434/v1', 'llama3.2-vision', TRUE,  '{"temperature": 0}'),
    ('TEXT',      'Local Reasoning',       'openai-compatible', 'http://host.docker.internal:11434/v1', 'llama3.1:8b',      TRUE,  '{"temperature": 0.2}'),
    ('CODE',      'Local Code (Qwen)',     'openai-compatible', 'http://host.docker.internal:11434/v1', 'qwen2.5-coder:7b', TRUE,  '{"temperature": 0.1}'),
    ('EMBEDDING', 'Local Embeddings',      'openai-compatible', 'http://host.docker.internal:11434/v1', 'nomic-embed-text', TRUE,  '{"dimensions": 768}')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
--  Default routing policy
-- ─────────────────────────────────────────────────────────────

INSERT INTO routing_policies (name, is_active, rules)
VALUES (
    'default',
    TRUE,
    '[
        {"when": {"input_kind": "image"}, "route_to": "VISION"},
        {"when": {"input_kind": "code"},  "route_to": "CODE"},
        {"when": {"needs_ocr": true},     "route_to": "OCR"},
        {"default": true, "route_to": "TEXT"}
    ]'::jsonb
) ON CONFLICT (name) DO NOTHING;
