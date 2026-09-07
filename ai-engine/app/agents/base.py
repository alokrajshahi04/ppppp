"""Base agent — common request lifecycle and model invocation helpers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.models.providers import get_provider


class BaseAgent(ABC):
    """All specialist agents share the same lifecycle: validate → fetch → invoke → assemble."""

    def __init__(self, capability: str):
        self.capability = capability
        self.provider = get_provider()

    @abstractmethod
    async def run(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """Execute the agent and return a result dict (matches Pydantic response)."""
