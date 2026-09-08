"""Retriever — top-k semantic search over pgvector."""

from __future__ import annotations

from sqlalchemy import text

from app.models.providers import get_provider
from app.schemas import RetrieveRequest, RetrievedChunk


class Retriever:
    async def retrieve(self, req: RetrieveRequest) -> dict:
        provider = get_provider()
        top_k = req.top_k or 8
        query_vec = (await provider.embed(inputs=[req.query]))[0]

        sql_filter = ""
        # pgvector's <=> needs an explicit vector: pass a bracket literal and
        # cast at the call site (a raw float[] has no matching operator).
        params: dict = {"q": "[" + ",".join(f"{x:.7g}" for x in query_vec) + "]", "k": top_k}
        if req.evidence_ids:
            sql_filter = "WHERE ec.evidence_id = ANY(:eids)"
            params["eids"] = [str(e) for e in req.evidence_ids]
        elif req.task_id:
            sql_filter = "WHERE ev.task_id = :tid"
            params["tid"] = str(req.task_id)

        sql = text(
            f"""
            SELECT ec.id           AS chunk_id,
                   ec.evidence_id  AS evidence_id,
                   ev.filename     AS filename,
                   ec.content      AS content,
                   1 - (ec.embedding <=> CAST(:q AS vector)) AS score
              FROM evidence_chunks ec
              JOIN evidence ev ON ev.id = ec.evidence_id
              {sql_filter}
             ORDER BY ec.embedding <=> CAST(:q AS vector)
             LIMIT :k
            """
        )

        with _session() as s:
            rows = s.execute(sql, params).fetchall()

        chunks = [
            RetrievedChunk(
                chunk_id=r.chunk_id,
                evidence_id=r.evidence_id,
                filename=r.filename,
                content=r.content,
                score=float(r.score),
            )
            for r in rows
        ]
        return {"chunks": [c.model_dump() for c in chunks]}


def _session():
    from app.storage.db import session_scope

    # We open a fresh session each call rather than holding one.
    return session_scope()
