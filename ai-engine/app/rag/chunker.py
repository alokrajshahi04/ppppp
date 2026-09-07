"""Text chunker — paragraph + sentence aware, with overlap."""

from __future__ import annotations

import re

from app.config import get_settings


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks based on paragraph + sentence boundaries."""
    settings = get_settings()
    chunk_size = settings.chunk_size
    overlap = settings.chunk_overlap

    # 1. Split on blank lines into paragraphs
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buf: list[str] = []
    buf_len = 0

    for p in paragraphs:
        # If single paragraph is bigger than chunk_size, fall back to sentence split.
        if len(p) > chunk_size:
            sentences = re.split(r"(?<=[.!?])\s+", p)
            for s in sentences:
                if buf_len + len(s) > chunk_size and buf:
                    chunks.append(" ".join(buf))
                    buf = buf[-overlap // max(len(s), 1):] if overlap else []
                    buf_len = sum(len(x) for x in buf)
                buf.append(s)
                buf_len += len(s)
        else:
            if buf_len + len(p) > chunk_size and buf:
                chunks.append(" ".join(buf))
                buf = buf[-overlap // max(len(p), 1):] if overlap else []
                buf_len = sum(len(x) for x in buf)
            buf.append(p)
            buf_len += len(p)

    if buf:
        chunks.append(" ".join(buf))
    return chunks
