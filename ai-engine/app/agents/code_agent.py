"""Code agent — code intelligence + assistance."""

from __future__ import annotations

import re

from app.agents.base import BaseAgent
from app.config import get_settings


class CodeAgent(BaseAgent):
    def __init__(self):
        super().__init__(capability="CODE")

    async def run(self, req) -> dict:
        settings = get_settings()
        messages = [
            {
                "role": "system",
                "content": (
                    "You are Tolti-Code, a code assistant. "
                    "Always respond with: a fenced code block in the requested language, "
                    "followed by a short explanation. Never invent APIs."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Language: {req.language or 'auto'}\n"
                    f"Context: {req.context or '(none)'}\n\n"
                    f"{req.prompt}"
                ),
            },
        ]

        result = await self.provider.chat(
            model_id=req.model_id or settings.code_model,
            messages=messages,
            temperature=0.1,
        )

        raw = result["content"]
        code, explanation = self._split(raw)
        return {
            "code": code,
            "explanation": explanation,
            "language": req.language or "text",
            "model": req.model_id or settings.code_model,
        }

    @staticmethod
    def _split(raw: str) -> tuple[str, str]:
        m = re.search(r"```(\w*)\n([\s\S]*?)```", raw)
        if not m:
            return raw, ""
        code = m.group(2)
        explanation = raw[m.end():].strip()
        return code, explanation
