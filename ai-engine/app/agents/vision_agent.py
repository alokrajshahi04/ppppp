"""Vision agent — describes images / diagrams using a vision-capable model."""

from __future__ import annotations

import base64

from app.agents.base import BaseAgent
from app.config import get_settings


class VisionAgent(BaseAgent):
    def __init__(self):
        super().__init__(capability="VISION")

    async def run(
        self,
        *,
        blob: bytes,
        filename: str,
        mime_type: str,
        prompt: str,
        context: str | None = None,
    ) -> dict:
        settings = get_settings()
        image_b64 = base64.b64encode(blob).decode("ascii")
        data_url = f"data:{mime_type};base64,{image_b64}"

        messages: list[dict] = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt + (f"\n\nContext:\n{context}" if context else "")},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ]

        result = await self.provider.chat(
            model_id=settings.vision_model,
            messages=messages,
            temperature=0,
            capability=self.capability,
        )

        description = result["content"]
        return {
            "description": description,
            "findings": [],
            "model": settings.vision_model,
        }
