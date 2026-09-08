"""Follow-up task automation — spins off a new room from this one.

Creates a real task in the same workspace, linked via parent_task_id, with a
summary description. Shows up immediately for the room members to pick up.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, ClassVar

from sqlalchemy import text

from app.automations.base import Automation, AutomationContext, AutomationParam
from app.storage.db import session_scope


class FollowupTaskAutomation(Automation):
    id = "followup_task"
    title = "Create follow-up task"
    description = "Opens a new room that continues from this one — for actions, reviews or handovers."
    keywords: ClassVar[list[str]] = [
        "follow up task", "followup task", "follow-up task",
        "create a follow", "spin off a task", "create task from this", "hand over to task",
    ]
    params: ClassVar[list[AutomationParam]] = [
        AutomationParam(name="title", label="Follow-up title", required=False, placeholder="e.g. Review bearing replacement"),
    ]

    async def run(self, ctx: AutomationContext, **kwargs: Any) -> dict:
        title = (kwargs.get("title") or "").strip() or f"Follow-up: {ctx.room_title}"
        summary = self._summary(ctx)
        now = datetime.now(timezone.utc).isoformat()

        with session_scope() as s:
            row = s.execute(
                text(
                    """
                    INSERT INTO tasks (workspace_id, title, description, status, priority, kind, driver_id, parent_task_id)
                    VALUES (:ws, :title, :desc, 'OPEN', 'MEDIUM', 'SHARED', :driver, :parent)
                    RETURNING id
                    """
                ),
                {
                    "ws": ctx.workspace_id,
                    "title": title[:160],
                    "desc": summary,
                    "driver": ctx.driver_id,
                    "parent": ctx.task_id,
                },
            ).fetchone()
            new_task_id = str(row[0])

            # The follow-up belongs to this room's members (driver + invited).
            s.execute(
                text(
                    """
                    INSERT INTO task_members (task_id, user_id, added_by)
                    SELECT :new_id, tm.user_id, :driver
                      FROM task_members tm
                     WHERE tm.task_id = :parent
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"new_id": new_task_id, "parent": ctx.task_id, "driver": ctx.driver_id},
            )

        return {
            "ok": True,
            "summary": f"Created follow-up room “{title}” with this room's members.",
            "details": {"task_id": new_task_id, "title": title},
        }

    @staticmethod
    def _summary(ctx: AutomationContext) -> str:
        evidence_names = ", ".join(e.get("filename", "?") for e in ctx.evidence) or "none"
        last = ctx.messages[-1] if ctx.messages else None
        last_line = f"Last discussion point: {last.get('sender')}: {last.get('content', '')[:200]}" if last else "No discussion yet."
        return (
            f"Spun off from “{ctx.room_title}” on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} "
            f"by the follow-up automation.\n\n"
            f"Context:\n- Evidence in parent room: {evidence_names}\n- Messages in parent room: {len(ctx.messages)}\n"
            f"- {last_line}\n"
        )
