"""Agent Router — decide which specialist / model handles a task."""

from fastapi import APIRouter, HTTPException

from app.logging import get_logger
from app.router.agent_router import AgentRouter
from app.schemas import RouteDecision, RouteRequest

router = APIRouter()
log = get_logger(__name__)


@router.post("/route", response_model=RouteDecision)
async def route(req: RouteRequest) -> RouteDecision:
    decision = await AgentRouter().decide(req)
    if not decision:
        raise HTTPException(status_code=500, detail="router could not produce a decision")
    return RouteDecision(**decision)
