"""Agent Router — decides which specialist handles a task."""

from __future__ import annotations

from app.config import get_settings
from app.automations import match_automation
from app.schemas import RouteRequest


class AgentRouter:
    """Pure rule-based router.

    Order of precedence:
      1. explicit capability from the caller
      2. automation keyword match (agentic actions from plain chat)
      3. evidence-kind and prompt heuristics
      4. default text reasoning
    """

    async def decide(self, req: RouteRequest) -> dict | None:
        settings = get_settings()
        prompt_l = req.prompt.lower()
        evidence_hint = req.input_kind

        # 1. Explicit capability wins
        if req.capability:
            return {
                "capability": req.capability,
                "model_id": _model_for(req.capability, settings),
                "reason": "explicit capability requested",
                "confidence": 1.0,
            }

        # 2. Automation match — plain chat can trigger agentic actions
        auto = match_automation(req.prompt)
        if auto:
            aid, params = auto
            from app.automations import get_automation
            inst = get_automation(aid)()
            return {
                "capability": "AUTOMATION",
                "model_id": f"automation:{aid}",
                "reason": f"matches automation “{inst.title}”",
                "confidence": 0.95,
                "params": params,
            }

        # 3. Evidence-kind heuristics
        if evidence_hint in {"IMAGE", "DIAGRAM"} or any(
            kw in prompt_l for kw in ("diagram", "schematic", "blueprint", "image", "photo", "scan")
        ):
            return {
                "capability": "VISION",
                "model_id": settings.vision_model,
                "reason": "image/diagram evidence detected",
                "confidence": 0.9,
            }

        # 4. OCR trigger
        if any(kw in prompt_l for kw in ("ocr", "extract text", "transcribe", "scan text")):
            return {
                "capability": "OCR",
                "model_id": settings.ocr_model,
                "reason": "OCR keyword detected",
                "confidence": 0.9,
            }

        # 5. Code trigger
        if any(
            kw in prompt_l
            for kw in ("code", "function", "script", "implement", "refactor", "bug", "compile")
        ):
            return {
                "capability": "CODE",
                "model_id": settings.code_model,
                "reason": "code keyword detected",
                "confidence": 0.85,
            }

        # 6. Default = text reasoning
        return {
            "capability": "TEXT",
            "model_id": settings.text_model,
            "reason": "default text reasoning",
            "confidence": 0.7,
        }


def _model_for(capability: str, settings) -> str:
    return {
        "OCR": settings.ocr_model,
        "VISION": settings.vision_model,
        "TEXT": settings.text_model,
        "CODE": settings.code_model,
        "EMBEDDING": settings.embedding_model,
    }.get(capability, settings.text_model)
