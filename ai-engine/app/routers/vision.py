"""Vision endpoint — describe images / diagrams."""

from fastapi import APIRouter, HTTPException

from app.agents.vision_agent import VisionAgent
from app.logging import get_logger
from app.schemas import VisionRequest, VisionResponse
from app.storage.minio_client import get_object_bytes

router = APIRouter()
log = get_logger(__name__)


@router.post("/vision", response_model=VisionResponse)
async def vision(req: VisionRequest) -> VisionResponse:
    try:
        blob = get_object_bytes(req.storage_key)
    except Exception as exc:
        log.error("vision.fetch_failed", key=req.storage_key, error=str(exc))
        raise HTTPException(status_code=404, detail=f"could not fetch object: {exc}") from exc

    agent = VisionAgent()
    try:
        result = await agent.run(
            blob=blob,
            filename=req.filename,
            mime_type=req.mime_type,
            prompt=req.prompt,
            context=req.context,
        )
    except Exception as exc:  # pragma: no cover
        log.error("vision.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"vision agent failed: {exc}") from exc

    return VisionResponse(**result)
