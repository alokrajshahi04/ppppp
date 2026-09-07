"""Abstract base for a model provider."""

from abc import ABC, abstractmethod
from typing import Any


class ModelProvider(ABC):
    capability: str

    @property
    @abstractmethod
    def default_embedding_model(self) -> str:
        ...

    @abstractmethod
    async def chat(
        self,
        *,
        model_id: str,
        messages: list[dict[str, Any]],
        temperature: float = 0.2,
        max_tokens: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Return {"content": str, "usage": dict|None}."""

    @abstractmethod
    async def embed(self, *, inputs: list[str], model: str | None = None) -> list[list[float]]:
        ...
