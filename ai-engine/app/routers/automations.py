"""Automation endpoints — list the registry and execute an automation."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID

from app.automations import list_automations
from app.automations.executor import execute_automation
from app.logging import get_logger

router = APIRouter()
log = get_logger(__name__)


class ExecuteRequest(BaseModel):
    task_id: UUID
    params: dict[str, Any] = {}


@router.get("/automations")
async def automations() -> list[dict]:
    """Registry listing — drives the UI and the Agent Router keywords."""
    return list_automations()


@router.post("/automations/{automation_id}/execute")
async def execute(automation_id: str, req: ExecuteRequest) -> dict:
    try:
        return await execute_automation(automation_id, str(req.task_id), req.params)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        log.error("automation.endpoint_failed", automation=automation_id, error=str(exc))
        raise HTTPException(status_code=502, detail=f"automation execution failed: {exc}") from exc
