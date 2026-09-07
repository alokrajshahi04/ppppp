"""Citation extraction — parse [cite:CHUNK_ID] markers and resolve to chunks."""

from __future__ import annotations

import re
from uuid import UUID

from app.schemas import Citation, ContextChunk

CITATION_PATTERN = re.compile(r"\[cite:([0-9a-fA-F-]{36})\]")


def extract_citations(answer: str, chunks: list[ContextChunk]) -> list[Citation]:
    """Match every [cite:UUID] marker in the answer and return a deduplicated Citation list."""
    chunk_by_id = {str(c.chunk_id): c for c in chunks}
    seen: set[str] = set()
    citations: list[Citation] = []

    for match in CITATION_PATTERN.finditer(answer):
        cid = match.group(1)
        if cid in seen:
            continue
        seen.add(cid)
        chunk = chunk_by_id.get(cid)
        if chunk is None:
            continue
        citations.append(
            Citation(
                evidence_id=chunk.evidence_id,
                chunk_id=chunk.chunk_id,
                quote=_best_quote(answer, match.start(), chunk.content),
                confidence=chunk.score,
            )
        )
    return citations


def _best_quote(answer: str, pos: int, chunk_content: str, window: int = 200) -> str:
    """Pick a representative slice of the chunk to attach as the citation quote."""
    start = max(0, pos - window)
    end = min(len(answer), pos + window)
    snippet = answer[start:end].strip()
    if snippet:
        return snippet
    # Fallback: just the first `window` chars of the chunk
    return chunk_content[:window]
