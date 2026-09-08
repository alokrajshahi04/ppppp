"""OpenAI-compatible provider.

Works against any endpoint that exposes:
    POST {base_url}/chat/completions
    POST {base_url}/embeddings
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings
from app.models.base import ModelProvider


class OpenAICompatibleProvider(ModelProvider):
    def __init__(self) -> None:
        settings = get_settings()
        self._embedding_model = settings.embedding_model
        self._timeout = settings.request_timeout_seconds
        default = (settings.model_default_base_url.rstrip("/"), settings.model_default_api_key)
        vision = (settings.model_vision_base_url.rstrip("/"), settings.model_vision_api_key)
        self._endpoints: dict[str | None, tuple[str, str]] = {
            None: default,
            "CODE": (settings.model_code_base_url.rstrip("/"), settings.model_code_api_key),
            "TEXT": (settings.model_text_base_url.rstrip("/"), settings.model_text_api_key),
            "VISION": vision,
            "OCR": vision,
        }
        self._clients: dict[str | None, httpx.AsyncClient] = {}

    @property
    def default_embedding_model(self) -> str:
        return self._embedding_model

    def _resolve(self, capability: str | None) -> tuple[str, str]:
        base_url, api_key = self._endpoints.get(capability, (None, None))
        if not base_url:
            return self._endpoints[None]
        return base_url, api_key or self._endpoints[None][1]

    async def _http(self, capability: str | None = None) -> httpx.AsyncClient:
        client = self._clients.get(capability)
        if client is None:
            base_url, api_key = self._resolve(capability)
            client = httpx.AsyncClient(
                base_url=base_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                timeout=self._timeout,
                follow_redirects=True,
            )
            self._clients[capability] = client
        return client

    async def chat(
        self,
        *,
        model_id: str,
        messages: list[dict[str, Any]],
        temperature: float = 0.2,
        max_tokens: int | None = None,
        capability: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        client = await self._http(capability)
        payload: dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if "qwen3" in model_id.lower() and "chat_template_kwargs" not in kwargs:
            kwargs["chat_template_kwargs"] = {"enable_thinking": False}
        payload.update(kwargs)

        resp = await client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        choice = data["choices"][0]
        content = choice["message"]["content"] or ""
        # Some reasoning models (Qwen3) inline their thinking in content even
        # with enable_thinking=False — keep only the final answer.
        if "<think>" in content:
            content = content.split("</think>")[-1].strip()
        return {
            "content": content,
            "usage": data.get("usage"),
        }

    async def embed(self, *, inputs: list[str], model: str | None = None) -> list[list[float]]:
        client = await self._http(None)
        resp = await client.post(
            "/embeddings",
            json={"model": model or self._embedding_model, "input": inputs},
        )
        resp.raise_for_status()
        data = resp.json()
        # OpenAI returns data sorted by index
        rows = sorted(data["data"], key=lambda r: r["index"])
        return [row["embedding"] for row in rows]
