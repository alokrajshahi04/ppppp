# ─────────────────────────────────────────────────────────────
#  Tolti AI · Modal GPU inference (cloud track)
#
#  Serves the model brains on Modal while DB/MinIO/backend stay local.
#  Both servers speak the OpenAI-compatible API, so switching profiles is
#  just a model_configs update:
#     VISION/OCR → GLM-4.1V-9B  (Zhipu, vLLM)   — "zlm ocr"
#     TEXT/CODE  → Qwen3-8B     (vLLM)
#
#  Deploy:   modal deploy ai-engine/modal_vllm.py
#  Try it:   curl https://<workspace>--tolti-vllm-serve-vision.modal.run/v1/models
#
#  Cost: L4 $0.000222/sec; scale-to-zero after `scaledown_window` — idle = $0.
# ─────────────────────────────────────────────────────────────

import subprocess

import modal

# Models (swap freely — config-driven everywhere else)
VISION_MODEL = "zai-org/GLM-4.1V-9B-Thinking"   # OCR + diagram/image understanding
TEXT_MODEL = "Qwen/Qwen3-8B"                    # reasoning + code

GPU = "L4"                     # 24 GB — fits both 9B/8B in bf16
SCALEDOWN_WINDOW = 300         # stay warm 5 min after the last request, then $0
MAX_MODEL_LEN = 8192

app = modal.App("tolti-vllm")

hf_cache = modal.Volume.from_name("tolti-hf-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    # transformers pinned: vllm 0.9.x crashes with transformers >= 4.53
    # (duplicate 'aimv2' registration at import time).
    .pip_install(
        "vllm==0.9.2",
        "transformers==4.52.4",
        "hf_transfer",
    )
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
)

# Models are public (not gated) — no HF token needed. If you switch to a
# gated model, create a secret: `modal secret create huggingface HF_TOKEN=...`
# and add it back: SECRETS = [modal.Secret.from_name("huggingface")]


def _serve(model: str, extra_args: list[str]):
    """Launch vLLM's OpenAI-compatible server bound to 0.0.0.0:8000."""
    cmd = [
        "vllm", "serve", model,
        "--host", "0.0.0.0",
        "--port", "8000",
        "--max-model-len", str(MAX_MODEL_LEN),
        "--gpu-memory-utilization", "0.92",
        "--disable-log-requests",
        *extra_args,
    ]
    subprocess.Popen(cmd)


@app.function(
    image=image,
    gpu=GPU,
    volumes={"/root/.cache/huggingface": hf_cache},
    scaledown_window=SCALEDOWN_WINDOW,
    timeout=60 * 60,
)
@modal.concurrent(max_inputs=32)
@modal.web_server(port=8000, startup_timeout=60 * 30)
def serve_vision():
    # Vision-language model — chat completions accept image_url (base64 data URLs).
    _serve(VISION_MODEL, [
        "--served-model-name", "glm-4.1v-9b",
        "--limit-mm-per-prompt", "image=2",
    ])


@app.function(
    image=image,
    gpu=GPU,
    volumes={"/root/.cache/huggingface": hf_cache},
    scaledown_window=SCALEDOWN_WINDOW,
    timeout=60 * 60,
)
@modal.concurrent(max_inputs=32)
@modal.web_server(port=8000, startup_timeout=60 * 30)
def serve_text():
    _serve(TEXT_MODEL, [
        "--served-model-name", "qwen3-8b",
    ])
