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
                    buf = _carry(buf, overlap)
                    buf_len = sum(len(x) for x in buf)
                buf.append(s)
                buf_len += len(s)
        else:
            if buf_len + len(p) > chunk_size and buf:
                chunks.append(" ".join(buf))
                buf = _carry(buf, overlap)
                buf_len = sum(len(x) for x in buf)
            buf.append(p)
            buf_len += len(p)

    if buf:
        chunks.append(" ".join(buf))
    return chunks


def _carry(buf: list[str], overlap: int) -> list[str]:
    """Keep the tail of `buf` totalling at most `overlap` characters.

    Note: a slice like buf[-n:] with n=0 returns the WHOLE list, so the old
    `buf[-overlap // len(s):]` arithmetic silently kept everything. This helper
    carries an honest tail instead.
    """
    if not overlap or not buf:
        return []
    kept: list[str] = []
    total = 0
    for item in reversed(buf):
        if total + len(item) > overlap and kept:
            break
        kept.insert(0, item)
        total += len(item)
    return kept
