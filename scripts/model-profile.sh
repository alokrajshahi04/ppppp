#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Tolti AI · switch AI model profile (local Ollama ↔ Modal GPU)
#  Usage: ./scripts/model-profile.sh local | cloud <modal-base-url> <proxy-token>
# ─────────────────────────────────────────────────────────────
set -euo pipefail

MODE="${1:-}"
PSQL="docker exec -i tolti-postgres psql -U tolti -d tolti"

case "$MODE" in
  local)
    $PSQL <<'SQL'
UPDATE model_configs SET
    base_url = 'http://host.docker.internal:11434/v1',
    api_key  = 'ollama',
    model_id = CASE capability
        WHEN 'TEXT'  THEN 'qwen3:4b'
        WHEN 'CODE'  THEN 'qwen3:4b'
        WHEN 'VISION'THEN 'qwen2.5vl:3b'
        WHEN 'OCR'   THEN 'qwen2.5vl:3b'
        WHEN 'EMBEDDING' THEN 'nomic-embed-text'
    END,
    is_default = TRUE
WHERE capability IN ('TEXT','CODE','VISION','OCR','EMBEDDING');
SQL
    echo "→ local profile: Ollama on this PC (qwen3:4b · qwen2.5vl:3b · nomic)"
    ;;
  cloud)
    BASE="${2:?usage: model-profile.sh cloud <modal-app-base> <proxy-token>}"
    TOKEN="${3:?usage: model-profile.sh cloud <modal-app-base> <proxy-token>}"
    # BASE is the app prefix, e.g. https://<workspace>--tolti-models
    $PSQL <<SQL
UPDATE model_configs SET
    base_url = '${BASE}-code-server.modal.run/v1',
    api_key  = '${TOKEN}',
    model_id = 'Qwen/Qwen2.5-Coder-7B-Instruct',
    is_default = TRUE
WHERE capability = 'CODE';

UPDATE model_configs SET
    base_url = '${BASE}-text-server.modal.run/v1',
    api_key  = '${TOKEN}',
    model_id = 'Qwen/Qwen3-8B',
    is_default = TRUE
WHERE capability = 'TEXT';

UPDATE model_configs SET
    base_url = '${BASE}-vision-server.modal.run/v1',
    api_key  = '${TOKEN}',
    model_id = 'Qwen/Qwen2.5-VL-7B-Instruct',
    is_default = TRUE
WHERE capability IN ('VISION','OCR');
SQL
    echo "→ cloud profile: Modal vLLM (code · text · vision) at $BASE"
    ;;
  *)
    echo "usage: $0 local | cloud <modal-base-url> <proxy-token>" >&2
    exit 1
    ;;
esac

echo "Current config:"
$PSQL -c "SELECT capability, model_id, base_url FROM model_configs WHERE is_default ORDER BY capability;"
