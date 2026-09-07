"""HTTP routers — one file per capability."""

from app.routers import code, embed, evidence, ocr, reason, retrieve, route, verify, vision

__all__ = [
    "code",
    "embed",
    "evidence",
    "ocr",
    "reason",
    "retrieve",
    "route",
    "verify",
    "vision",
]
