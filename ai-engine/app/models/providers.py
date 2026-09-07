"""Model provider abstraction — every model speaks the OpenAI-compatible interface.

A single adapter retargets the whole system. Swap base_url + api_key and the
backend can talk to Ollama, vLLM, LM Studio, llama.cpp's server, or any other
OpenAI-compatible endpoint — without changing the agents.
"""

from app.models.base import ModelProvider
from app.models.openai_compatible import OpenAICompatibleProvider

_provider: ModelProvider | None = None


def get_provider() -> ModelProvider:
    global _provider
    if _provider is None:
        _provider = OpenAICompatibleProvider()
    return _provider


def set_provider(provider: ModelProvider) -> None:
    """Override the default provider (used in tests)."""
    global _provider
    _provider = provider
