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
    """Pick a quote FROM THE SOURCE CHUNK that supports the claim near the marker.

    The claim is approximated by the answer text around the citation marker; the
    best-matching sentence of the chunk becomes the quote. Falls back to the
    opening of the chunk so a citation always quotes the document, never the
    model's own answer.
    """
    claim = answer[max(0, pos - window): pos + window].strip()
    sentence = _best_matching_sentence(chunk_content, claim)
    if sentence:
        return sentence
    head = chunk_content[:window].strip()
    return head or chunk_content.strip()


def _best_matching_sentence(chunk_content: str, claim: str, max_len: int = 240) -> str | None:
    """Return the chunk sentence sharing the most meaningful words with the claim."""
    import re as _re

    claim_words = {w for w in _re.findall(r"[a-zA-Z0-9]+", claim.lower()) if len(w) > 2}
    if not claim_words:
        return None

    best: tuple[int, str] | None = None
    for sentence in _re.split(r"(?<=[.!?])\s+|\n+", chunk_content):
        s = sentence.strip()
        if len(s) < 12:
            continue
        words = {w for w in _re.findall(r"[a-zA-Z0-9]+", s.lower()) if len(w) > 2}
        overlap = len(words & claim_words)
        if best is None or overlap > best[0]:
            best = (overlap, s)
    if best is None or best[0] == 0:
        return None
    quote = best[1]
    return quote if len(quote) <= max_len else quote[: max_len - 1].rstrip() + "…"
