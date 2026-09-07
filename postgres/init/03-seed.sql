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
    '$2b$10$ZbY7eMQQxQH5ZyN4uMwxLuQEDz4YvU7gZP9W5wswzKApQ3vQyJ8S.'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO user_system_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'ADMIN')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
--  Demo driver / reviewer / watcher / security approver
-- ─────────────────────────────────────────────────────────────

INSERT INTO users (id, email, display_name, password_hash) VALUES
    ('00000000-0000-0000-0000-000000000002', 'driver@tolti.ai',     'Driver Demo',    '$2b$10$ZbY7eMQQxQH5ZyN4uMwxLuQEDz4YvU7gZP9W5wswzKApQ3vQyJ8S.'),
    ('00000000-0000-0000-0000-000000000003', 'reviewer@tolti.ai',   'Reviewer Demo',  '$2b$10$ZbY7eMQQxQH5ZyN4uMwxLuQEDz4YvU7gZP9W5wswzKApQ3vQyJ8S.'),
    ('00000000-0000-0000-0000-000000000004', 'watcher@tolti.ai',    'Watcher Demo',   '$2b$10$ZbY7eMQQxQH5ZyN4uMwxLuQEDz4YvU7gZP9W5wswzKApQ3vQyJ8S.'),
    ('00000000-0000-0000-0000-000000000005', 'security@tolti.ai',   'Security Demo',  '$2b$10$ZbY7eMQQxQH5ZyN4uMwxLuQEDz4YvU7gZP9W5wswzKApQ3vQyJ8S.')
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

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000002', 'DRIVER'),
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000003', 'REVIEWER'),
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000004', 'WATCHER'),
    ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000005', 'SECURITY_APPROVER')
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
