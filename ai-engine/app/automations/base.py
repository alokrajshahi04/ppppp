"""Automation registry — pluggable agentic actions.

Adding a new automation is a single file in this package:
    1. Subclass `Automation`, set the class attributes, implement `run()`.
    2. The registry discovers it automatically (subclass scan).
No other file needs to change: listing, routing keywords and execution all
come from the registry.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class AutomationParam:
    name: str
    label: str
    required: bool = False
    placeholder: str = ""

    def dict(self) -> dict:
        return {
            "name": self.name,
            "label": self.label,
            "required": self.required,
            "placeholder": self.placeholder,
        }


class Automation:
    id: str = ""
    title: str = ""
    description: str = ""
    keywords: list[str] = []
    params: list[AutomationParam] = []

    async def run(self, ctx: "AutomationContext", **kwargs: Any) -> dict:
        raise NotImplementedError


@dataclass
class AutomationContext:
    """Everything an automation may touch, handed to run()."""

    task_id: str
    workspace_id: str
    room_title: str
    driver_id: str
    driver_name: str
    members: list[dict]
    messages: list[dict]
    evidence: list[dict]
