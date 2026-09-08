#!/usr/bin/env bash
# Pre-warm the Modal GPU servers (text/code + vision) before a demo or test.
#
# Cold vLLM boots take 1.5-2.5 min; run this ~3 minutes before you need the
# models. Reads the proxy token from .env — it is never printed.
#
# Usage: ./scripts/prewarm.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then echo ".env not found"; exit 1; fi
KEY=$(grep '^MODEL_TEXT_API_KEY=' .env | cut -d= -f2-)
if [ -z "$KEY" ]; then echo "MODEL_TEXT_API_KEY missing in .env"; exit 1; fi

warm() {
    local name="$1" url="$2"
    local code time
    result=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" --max-time 600 \
        -H "Authorization: Bearer $KEY" "$url" || true)
    code=${result%% *}
    time=${result##* }
    if [ "$code" = "200" ]; then
        echo "  $name: warm (http 200, ${time}s)"
    else
        echo "  $name: http $code after ${time}s — check modal deploy"
    fi
}

echo "Pre-warming Modal servers (cold boots take up to ~2.5 min)..."
warm "text+code" "https://alokrajshahi95--tolti-models-text-server.modal.run/v1/models"
warm "vision   " "https://alokrajshahi95--tolti-models-vision-server.modal.run/v1/models"
echo "Done. Models stay warm for 60 min after the last request."
