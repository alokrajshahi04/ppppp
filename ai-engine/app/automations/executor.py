"""Automation execution — builds context from the DB and runs a registered automation."""

from __future__ import annotations

from sqlalchemy import text

from app.automations import get_automation
from app.automations.base import AutomationContext
from app.logging import get_logger
from app.storage.db import session_scope

log = get_logger(__name__)


async def build_context(task_id: str) -> AutomationContext:
    with session_scope() as s:
        task = s.execute(
            text(
                """
                SELECT t.id, t.workspace_id, t.title, t.driver_id, u.display_name AS driver_name
                  FROM tasks t JOIN users u ON u.id = t.driver_id
                 WHERE t.id = :tid
                """
            ),
            {"tid": task_id},
        ).fetchone()
        if task is None:
            raise ValueError(f"task {task_id} not found")

        members = s.execute(
            text(
                """
                SELECT u.id AS user_id, u.display_name
                  FROM tasks t JOIN users u ON u.id = t.driver_id
                 WHERE t.id = :tid
                 UNION
                 SELECT u.id, u.display_name
                   FROM task_members tm JOIN users u ON u.id = tm.user_id
                  WHERE tm.task_id = :tid
                """
            ),
            {"tid": task_id},
        ).fetchall()

        messages = s.execute(
            text(
                """
                SELECT COALESCE(u.display_name, 'system') AS sender, m.content, m.created_at
                  FROM messages m LEFT JOIN users u ON u.id = m.sender_id
                 WHERE m.task_id = :tid
                 ORDER BY m.created_at ASC
                """
            ),
            {"tid": task_id},
        ).fetchall()

        evidence = s.execute(
            text(
                """
                SELECT filename, kind::text AS kind, ocr_completed
                  FROM evidence WHERE task_id = :tid
                 ORDER BY uploaded_at ASC
                """
            ),
            {"tid": task_id},
        ).fetchall()

    return AutomationContext(
        task_id=str(task.id),
        workspace_id=str(task.workspace_id),
        room_title=task.title,
        driver_id=str(task.driver_id),
        driver_name=task.driver_name,
        members=[dict(r._mapping) for r in members],
        messages=[dict(r._mapping) for r in messages],
        evidence=[dict(r._mapping) for r in evidence],
    )


async def post_system_message(task_id: str, content: str) -> None:
    with session_scope() as s:
        s.execute(
            text(
                """
                INSERT INTO messages (task_id, sender_id, kind, content)
                VALUES (:tid, NULL, 'SYSTEM', :content)
                """
            ),
            {"tid": task_id, "content": content},
        )


async def execute_automation(automation_id: str, task_id: str, params: dict | None = None) -> dict:
    cls = get_automation(automation_id)
    if cls is None:
        return {"ok": False, "error": f"Unknown automation “{automation_id}”."}

    ctx = await build_context(task_id)
    inst = cls()
    try:
        result = await inst.run(ctx, **(params or {}))
    except Exception as exc:  # surface as actionable run failure
        import traceback
        log.error("automation.failed", automation=automation_id,
                  error=str(exc), trace=traceback.format_exc()[-1200:])
        return {"ok": False, "error": f"Automation failed: {exc}"}

    if result.get("ok"):
        await post_system_message(
            task_id,
            f"Automation “{inst.title}” completed — {result.get('summary', 'done.')}",
        )
    return result
