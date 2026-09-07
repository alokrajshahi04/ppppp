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
        self._base_url = settings.model_default_base_url.rstrip("/")
        self._api_key = settings.model_default_api_key
        self._embedding_model = settings.embedding_model
        self._timeout = settings.request_timeout_seconds
        self._client: httpx.AsyncClient | None = None

    @property
    def default_embedding_model(self) -> str:
        return self._embedding_model

    async def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                timeout=self._timeout,
            )
        return self._client

    async def chat(
        self,
        *,
        model_id: str,
        messages: list[dict[str, Any]],
        temperature: float = 0.2,
        max_tokens: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        client = await self._http()
        payload: dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        resp = await client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        choice = data["choices"][0]
        return {
            "content": choice["message"]["content"],
            "usage": data.get("usage"),
        }

    async def embed(self, *, inputs: list[str], model: str | None = None) -> list[list[float]]:
        client = await self._http()
        resp = await client.post(
            "/embeddings",
            json={"model": model or self._embedding_model, "input": inputs},
        )
        resp.raise_for_status()
        data = resp.json()
        # OpenAI returns data sorted by index
        rows = sorted(data["data"], key=lambda r: r["index"])
        return [row["embedding"] for row in rows]
