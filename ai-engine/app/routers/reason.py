"""Reasoning endpoint — text/chat with RAG context, SSE-streamable."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agents.reason_agent import ReasonAgent
from app.logging import get_logger
from app.schemas import ReasoningRequest, ReasoningResponse

router = APIRouter()
log = get_logger(__name__)


@router.post("/reason", response_model=ReasoningResponse)
async def reason(req: ReasoningRequest) -> ReasoningResponse:
    if req.stream:
        # Hand off to the SSE variant
        return await _reason_stream(req)  # type: ignore[return-value]

    agent = ReasonAgent()
    try:
        result = await agent.run(req)
    except Exception as exc:  # pragma: no cover
        log.error("reason.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"reason agent failed: {exc}") from exc

    return ReasoningResponse(**result)


async def _reason_stream(req: ReasoningRequest):
    agent = ReasonAgent()

    async def event_generator():
        try:
            async for chunk in agent.stream(req):
                yield chunk.model_dump_json().encode() + b"\n"
        except Exception as exc:  # pragma: no cover
            log.error("reason.stream_failed", error=str(exc))
            yield b'{"type":"error","error":"' + str(exc).encode() + b'"}\n'

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")
