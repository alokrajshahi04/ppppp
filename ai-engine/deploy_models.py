"""TOLTI AI: three vLLM servers protected by Modal proxy authentication.

Deployment (persistent endpoints):
    modal deploy deploy_models.py

Verify with plain HTTPS — do NOT `modal run` against a deployed `tolti-models`
app. `modal run` always spins up an ephemeral app under the same name, which
STOPS the deployed app and leaves no service behind once the run ends or is
aborted. (That's how this stack got fubar-ed on the first attempt.)

    # Bearer = "<Modal-Key>.<Modal-Secret>"
    BEARER="$TOLTI_MODAL_PROXY_KEY.$TOLTI_MODAL_PROXY_SECRET"

    curl -s https://alokrajshahi95--tolti-models-code-server.modal.run/health \
         -H "Authorization: Bearer $BEARER"

    curl -s https://alokrajshahi95--tolti-models-code-server.modal.run/v1/chat/completions \
         -H "Authorization: Bearer $BEARER" -H 'Content-Type: application/json' \
         -d '{"model":"Qwen/Qwen2.5-Coder-7B-Instruct",
              "messages":[{"role":"user","content":"Write a Python hello world"}],
              "max_tokens":64}'

Test the file's current code in an isolated ephemeral app (safe in a separate
workspace, or after deleting any existing `tolti-models` deployment):
    modal run deploy_models.py --model code --target current

Qwen3 callers must send chat_template_kwargs={"enable_thinking": False}.
Pin model revisions to tested commit hashes before production.
Deployment and real inference can incur cloud charges; run only with approval.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
from typing import Any

import aiohttp
import modal

APP_NAME = "tolti-models"
app = modal.App(APP_NAME)

CODE_MODEL_ID = "Qwen/Qwen2.5-Coder-7B-Instruct"
TEXT_MODEL_ID = "Qwen/Qwen3-8B"
VL_MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct"
CODE_MODEL_REVISION = os.environ.get("TOLTI_CODE_REVISION", "main")
TEXT_MODEL_REVISION = os.environ.get("TOLTI_TEXT_REVISION", "main")
VL_MODEL_REVISION = os.environ.get("TOLTI_VL_REVISION", "main")

VLLM_PORT = 8000
GPU_TYPE = "L40S"
TENSOR_PARALLEL = 1
IDLE_TIMEOUT = 30 * 60  # Preserves your setting; idle GPU time can be billed.
SERVER_STARTUP_TIMEOUT = 10 * 60

vllm_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.9.0-devel-ubuntu22.04",
        add_python="3.12",
    )
    .entrypoint([])
    .uv_pip_install("vllm==0.21.0")
    .env(
        {
            "HF_XET_HIGH_PERFORMANCE": "1",
            "VLLM_LOG_STATS_INTERVAL": "1",
            # Carry deployment-time revision settings into the containers.
            "TOLTI_CODE_REVISION": CODE_MODEL_REVISION,
            "TOLTI_TEXT_REVISION": TEXT_MODEL_REVISION,
            "TOLTI_VL_REVISION": VL_MODEL_REVISION,
        }
    )
)

hf_secret = modal.Secret.from_name("tolti-hf")
# No endpoint-auth secret is mounted: Modal's proxy enforces authentication.
# Keep proxy credentials in the caller/backend, not in these model containers.

# 16x16 solid red PNG — self-contained image for the vision smoke test.
SMOKE_IMAGE_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGN4bmNDEmIY"
    "1TCqYfhqAABFll8QDpffqQAAAABJRU5ErkJggg=="
)


def _start_vllm(model_id: str, revision: str, extra_args: list[str] | None = None) -> None:
    cmd = [
        "vllm", "serve", model_id,
        "--revision", revision,
        "--served-model-name", model_id, "llm",
        "--host", "0.0.0.0",
        "--port", str(VLLM_PORT),
        "--uvicorn-log-level", "info",
        "--async-scheduling",
        "--tensor-parallel-size", str(TENSOR_PARALLEL),
        *(extra_args or []),
    ]
    print(f"Starting {model_id}; configured revision={revision}", flush=True)
    # Keep stdout/stderr attached so startup failures appear in Modal logs.
    subprocess.Popen(cmd)
    # Return immediately. Modal waits for the port and manages the container.
    # Do not add a sleep loop, subprocess.run(), or process.wait().


@app.function(
    image=vllm_image,
    gpu=GPU_TYPE,
    scaledown_window=IDLE_TIMEOUT,
    startup_timeout=SERVER_STARTUP_TIMEOUT + 60,
    timeout=10 * 60,
    secrets=[hf_secret],
)
@modal.web_server(
    port=VLLM_PORT,
    startup_timeout=SERVER_STARTUP_TIMEOUT,
    requires_proxy_auth=True,
)
def code_server() -> None:
    """Serve the code model in its own GPU container."""
    _start_vllm(CODE_MODEL_ID, CODE_MODEL_REVISION)


@app.function(
    image=vllm_image,
    gpu=GPU_TYPE,
    scaledown_window=IDLE_TIMEOUT,
    startup_timeout=SERVER_STARTUP_TIMEOUT + 60,
    timeout=10 * 60,
    secrets=[hf_secret],
)
@modal.web_server(
    port=VLLM_PORT,
    startup_timeout=SERVER_STARTUP_TIMEOUT,
    requires_proxy_auth=True,
)
def text_server() -> None:
    """Serve Qwen3; callers explicitly request non-thinking mode."""
    _start_vllm(TEXT_MODEL_ID, TEXT_MODEL_REVISION)


@app.function(
    image=vllm_image,
    gpu=GPU_TYPE,
    scaledown_window=IDLE_TIMEOUT,
    startup_timeout=SERVER_STARTUP_TIMEOUT + 60,
    timeout=10 * 60,
    secrets=[hf_secret],
)
@modal.web_server(
    port=VLLM_PORT,
    startup_timeout=SERVER_STARTUP_TIMEOUT,
    requires_proxy_auth=True,
)
def vision_server() -> None:
    """Serve the vision-language model (chat completions accept image_url)."""
    # vLLM >= 0.18 expects --limit-mm-per-prompt as a JSON object.
    _start_vllm(VL_MODEL_ID, VL_MODEL_REVISION, ["--limit-mm-per-prompt", '{"image": 2}'])


async def _wait_for_health(
    session: aiohttp.ClientSession,
    deadline: float,
) -> None:
    """Retry only transient health failures, within the overall deadline."""
    retryable_statuses = {429, 500, 502, 503, 504}
    last_error = "No response received"

    while time.monotonic() < deadline:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            async with session.get(
                "/health",
                timeout=aiohttp.ClientTimeout(total=min(30.0, remaining)),
                allow_redirects=False,
            ) as response:
                if response.status == 200:
                    return
                detail = (await response.text())[:500]
                last_error = f"HTTP {response.status}: {detail}"
                if response.status not in retryable_statuses:
                    # Includes 401/403/404: waiting will not fix auth or URL errors.
                    raise RuntimeError(f"Health check failed: {last_error}")
        except (aiohttp.ClientConnectionError, asyncio.TimeoutError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"

        remaining = deadline - time.monotonic()
        if remaining > 0:
            await asyncio.sleep(min(2.0, remaining))

    raise TimeoutError(f"Health check timed out. Last failure: {last_error}")


@app.local_entrypoint()
async def smoke(
    model: str = "code",
    prompt: str = "",
    timeout: int = 15 * 60,
    target: str = "deployed",
) -> None:
    """Run one authenticated inference request against the ephemeral app.

    Only `target='current'` is supported — `modal run` against a deployed app
    of the same name would stop the deployment; verify deployed endpoints
    with `curl` instead (see the module docstring).
    """
    if model not in {"code", "text", "vision"}:
        raise ValueError("model must be 'code', 'text' or 'vision'")
    if target != "current":
        raise ValueError("target must be 'current'; use curl to verify deployed endpoints")
    if timeout <= 0:
        raise ValueError("timeout must be positive")

    proxy_key = os.environ.get("TOLTI_MODAL_PROXY_KEY")
    proxy_secret = os.environ.get("TOLTI_MODAL_PROXY_SECRET")
    if not proxy_key or not proxy_secret:
        raise RuntimeError(
            "Set TOLTI_MODAL_PROXY_KEY and TOLTI_MODAL_PROXY_SECRET locally "
            "using a Modal proxy-auth token pair. Do not use SDK API tokens."
        )

    function_by_model = {"code": "code_server", "text": "text_server", "vision": "vision_server"}
    model_ids = {"code": CODE_MODEL_ID, "text": TEXT_MODEL_ID, "vision": VL_MODEL_ID}
    default_prompts = {
        "code": "Write a Python hello world.",
        "text": "Summarise in one sentence: The pump inspection is complete. "
                "No leaks were found. The next inspection is on Friday.",
        "vision": "What color dominates this image? Answer with one word.",
    }

    # The ephemeral app created by `modal run` exposes every decorated web
    # function under its own URL, so we resolve to the in-file object.
    server = {"code": code_server, "text": text_server, "vision": vision_server}[model]

    url = await server.get_web_url.aio()
    if not url:
        raise RuntimeError("The selected function has no web endpoint URL")

    if not prompt:
        prompt = default_prompts[model]

    if model == "vision":
        content: Any = [
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{SMOKE_IMAGE_B64}"}},
            {"type": "text", "text": prompt},
        ]
    else:
        content = prompt

    payload: dict[str, Any] = {
        "model": model_ids[model],
        "messages": [{"role": "user", "content": content}],
        "stream": False,
        "max_tokens": 128,
    }
    if model == "text":
        payload["chat_template_kwargs"] = {"enable_thinking": False}

    headers = {"Modal-Key": proxy_key, "Modal-Secret": proxy_secret}
    deadline = time.monotonic() + timeout
    print(f"Smoke-testing {target} {model} endpoint: {url}", flush=True)

    async with aiohttp.ClientSession(base_url=url, headers=headers) as session:
        await _wait_for_health(session, deadline)
        print("Health OK; sending one inference request", flush=True)

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Smoke-test deadline reached before inference")

        try:
            async with session.post(
                "/v1/chat/completions",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=remaining),
                allow_redirects=False,
            ) as response:
                body = await response.text()
                if response.status != 200:
                    raise RuntimeError(
                        f"Inference failed: HTTP {response.status}: {body[:1000]}"
                    )
        except (aiohttp.ClientConnectionError, asyncio.TimeoutError) as exc:
            raise RuntimeError(
                "Inference connection failed or timed out. It was NOT retried; "
                "the server may still be processing the request."
            ) from exc

    try:
        data = json.loads(body)
        content = data["choices"][0]["message"]["content"]
    except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Inference returned an invalid completion response") from exc
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Inference returned an empty text completion")

    print("Inference OK (output generated, not executed):")
    print(content)
