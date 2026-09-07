"""Embedding endpoint — wraps an OpenAI-compatible embeddings API."""

from fastapi import APIRouter, HTTPException

from app.logging import get_logger
from app.models.providers import get_provider
from app.schemas import EmbedRequest, EmbedResponse

router = APIRouter()
log = get_logger(__name__)


@router.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest) -> EmbedResponse:
    inputs = [req.input] if isinstance(req.input, str) else req.input
    if not inputs:
        raise HTTPException(status_code=400, detail="input must not be empty")

    provider = get_provider()
    try:
        vectors = await provider.embed(inputs=inputs, model=req.model_id)
    except Exception as exc:  # pragma: no cover
        log.error("embed.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"upstream embedding failed: {exc}") from exc

    return EmbedResponse(
        embeddings=vectors,
        model=req.model_id or provider.default_embedding_model,
        dimensions=len(vectors[0]) if vectors else 0,
    )
