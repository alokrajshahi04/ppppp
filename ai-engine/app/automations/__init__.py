"""Automation implementations.

Each file registers itself by subclassing Automation; the registry in
__init__.py discovers subclasses automatically, so adding a new agentic
action means dropping one file in this folder — nothing else changes.
"""

from app.automations.base import Automation, AutomationContext, AutomationParam
from app.automations.email_summary import EmailSummaryAutomation
from app.automations.export_report import ExportReportAutomation
from app.automations.followup_task import FollowupTaskAutomation

REGISTRY: dict[str, type[Automation]] = {}


def _register(cls: type[Automation]) -> None:
    inst = cls()
    REGISTRY[inst.id] = cls


for _cls in (EmailSummaryAutomation, ExportReportAutomation, FollowupTaskAutomation):
    _register(_cls)


def list_automations() -> list[dict]:
    out = []
    for cls in REGISTRY.values():
        inst = cls()
        out.append({
            "id": inst.id,
            "title": inst.title,
            "description": inst.description,
            "keywords": cls.keywords,
            "params": [p.dict() for p in cls.params],
        })
    return out


def get_automation(automation_id: str) -> type[Automation] | None:
    return REGISTRY.get(automation_id)


def match_automation(prompt: str) -> tuple[str, dict] | None:
    """Best-effort: match a prompt to an automation and extract params.

    Returns (automation_id, params) or None. Parameter extraction is
    intentionally simple (regex for emails); automations validate the rest.
    """
    import re

    low = prompt.lower()
    emails = re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", prompt)

    best: tuple[str, int] | None = None
    for aid, cls in REGISTRY.items():
        score = sum(1 for kw in cls.keywords if kw in low)
        if score > 0 and (best is None or score > best[1]):
            best = (aid, score)
    if not best:
        return None

    aid = best[0]
    params: dict[str, Any] = {}
    inst = REGISTRY[aid]()
    if aid == "email_summary" and emails:
        params["to"] = emails[0]
    return aid, params


__all__ = [
    "Automation",
    "AutomationContext",
    "AutomationParam",
    "list_automations",
    "get_automation",
    "match_automation",
]
