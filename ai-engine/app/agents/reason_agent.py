"""Reasoning agent — RAG-augmented text / chat with citation extraction."""

from __future__ import annotations

import json
import re
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.config import get_settings
from app.schemas import (
    Citation,
    ReasoningRequest,
    StreamChunk,
    TokenUsage,
)
from app.verification.citations import extract_citations


class ReasonAgent(BaseAgent):
    def __init__(self):
        super().__init__(capability="TEXT")

    async def run(self, req: ReasoningRequest) -> dict:
        settings = get_settings()
        messages = self._build_messages(req)
        result = await self.provider.chat(
            model_id=req.model_id or settings.text_model,
            messages=messages,
            temperature=req.temperature or 0.2,
            max_tokens=req.max_tokens,
            capability=self.capability,
        )

        answer = result["content"]
        citations = extract_citations(answer, req.context_chunks or [])
        # The UI renders citations as its own list (chunk ids live on the
        # citation objects), so strip all inline [cite:...] markers — resolved
        # or hallucinated — to keep the answer text clean.
        answer = re.sub(r"\s*\[cite:[^\]]{1,80}\]", "", answer).strip()

        usage = result.get("usage") or {}
        return {
            "answer": answer,
            "citations": [c.model_dump() for c in citations],
            "model": req.model_id or settings.text_model,
            "token_usage": {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
        }

    async def stream(self, req: ReasoningRequest) -> AsyncIterator[StreamChunk]:
        # Default non-streaming path; individual providers may override.
        result = await self.run(req)
        yield StreamChunk(type="start", status="RUNNING")
        yield StreamChunk(type="token", content=result["answer"])
        for c in result["citations"]:
            yield StreamChunk(type="citation", citation=Citation(**c))
        yield StreamChunk(type="done", status="SUCCEEDED")

    def _build_messages(self, req: ReasoningRequest) -> list[dict]:
        sys = req.system_prompt or (
            "You are Tolti, the sovereign on-prem assistant. "
            "Answer only using the supplied evidence. For every non-trivial claim, "
            "attach an inline citation of the form [cite:CHUNK_ID]. "
            "If the evidence does not contain the answer, say so plainly."
        )

        context_block = ""
        if req.context_chunks:
            context_block = "\n\n---\nEVIDENCE\n---\n"
            for i, c in enumerate(req.context_chunks, start=1):
                context_block += (
                    f"\n[{i}] (chunk_id={c.chunk_id}, evidence_id={c.evidence_id}, "
                    f"score={c.score:.3f})\n{c.content}\n"
                )

        user = req.prompt + context_block
        messages: list[dict] = [{"role": "system", "content": sys}]
        # Recent room conversation — follow-up questions actually follow up.
        for turn in (req.history or [])[-8:]:
            if turn.role in ("user", "assistant") and turn.content.strip():
                messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": user})
        return messages
