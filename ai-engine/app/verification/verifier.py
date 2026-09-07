"""Verifier — judge a claim against its citations."""

from __future__ import annotations

from app.config import get_settings
from app.models.providers import get_provider
from app.schemas import VerifyRequest, VerifyResponse


class Verifier:
    async def verify(self, req: VerifyRequest) -> dict:
        settings = get_settings()
        provider = get_provider()

        evidence_block = "\n\n".join(
            f"[{i + 1}] {c.quote}" for i, c in enumerate(req.citations)
        )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a rigorous evidence reviewer. "
                    "Given a CLAIM and a set of CITATIONS (quoted evidence), decide if the claim is "
                    "SUPPORTED, PARTIAL, UNSUPPORTED, or CONTRADICTED by the citations. "
                    "Respond with a JSON object exactly of the form: "
                    '{"verdict": "...", "confidence": 0..1, "reasoning": "..."}'
                ),
            },
            {
                "role": "user",
                "content": f"CLAIM:\n{req.claim}\n\nCITATIONS:\n{evidence_block}",
            },
        ]

        result = await provider.chat(
            model_id=settings.text_model,
            messages=messages,
            temperature=0,
        )

        return _parse(result["content"])


def _parse(raw: str) -> dict:
    import json
    import re

    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return {
            "verdict": "UNSUPPORTED",
            "confidence": 0.0,
            "reasoning": "verifier produced no parseable verdict",
        }
    try:
        parsed = json.loads(m.group(0))
        return {
            "verdict": parsed.get("verdict", "UNSUPPORTED"),
            "confidence": float(parsed.get("confidence", 0.0)),
            "reasoning": parsed.get("reasoning", ""),
        }
    except Exception:
        return {
            "verdict": "UNSUPPORTED",
            "confidence": 0.0,
            "reasoning": "verifier verdict JSON could not be parsed",
        }
