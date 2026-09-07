"""Code endpoint — code intelligence + assistance."""

from fastapi import APIRouter, HTTPException

from app.agents.code_agent import CodeAgent
from app.logging import get_logger
from app.schemas import CodeRequest, CodeResponse

router = APIRouter()
log = get_logger(__name__)


@router.post("/code", response_model=CodeResponse)
async def code(req: CodeRequest) -> CodeResponse:
    agent = CodeAgent()
    try:
        result = await agent.run(req)
    except Exception as exc:  # pragma: no cover
        log.error("code.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"code agent failed: {exc}") from exc

    return CodeResponse(**result)
