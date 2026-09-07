"""Export report automation — builds a Markdown report and stores it in MinIO.

Produces a real artifact: the report lands in object storage and is attached
to the room as evidence, so it appears in Documents and is retrievable.
"""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Any, ClassVar

from sqlalchemy import text

from app.automations.base import Automation, AutomationContext
from app.storage.db import session_scope
from app.storage.minio_client import presigned_download_url, _bucket, _client


class ExportReportAutomation(Automation):
    id = "export_report"
    title = "Export room report"
    description = "Generates a Markdown report of this room (context, evidence, discussion) and files it under Documents."
    keywords: ClassVar[list[str]] = ["export", "report", "download summary", "generate report"]

    async def run(self, ctx: AutomationContext, **kwargs: Any) -> dict:
        report = self._compose(ctx)
        now = datetime.now(timezone.utc)
        filename = f"report-{now.strftime('%Y%m%d-%H%M%S')}.md"
        key = f"reports/{ctx.task_id}/{filename}"
        payload = report.encode("utf-8")

        client = _client()
        client.put_object(_bucket(), key, BytesIO(payload), len(payload), content_type="text/markdown")

        # Attach to the room as evidence so it shows up in Documents.
        with session_scope() as s:
            row = s.execute(
                text(
                    """
                    INSERT INTO evidence
                        (task_id, uploaded_by, kind, filename, mime_type, byte_size, storage_key, metadata)
                    VALUES
                        (:task_id, :uploaded_by, 'OTHER', :filename, 'text/markdown', :size, :key, CAST(:meta AS jsonb))
                    RETURNING id
                    """
                ),
                {
                    "task_id": ctx.task_id,
                    "uploaded_by": ctx.driver_id,
                    "filename": filename,
                    "size": len(payload),
                    "key": key,
                    "meta": '{"source": "automation:export_report"}',
                },
            ).fetchone()
            evidence_id = str(row[0])

        url = presigned_download_url(key, 3600)
        return {
            "ok": True,
            "summary": f"Report exported and filed as {filename} in this room's Documents.",
            "details": {"evidence_id": evidence_id, "filename": filename, "download_url": url},
        }

    @staticmethod
    def _compose(ctx: AutomationContext) -> str:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        lines = [
            f"# Room report — {ctx.room_title}",
            f"_Generated {now} by Tolti automation_",
            "",
            "## Context",
            f"- Driver: **{ctx.driver_name}**",
            f"- Members: {', '.join(m.get('display_name', '?') for m in ctx.members) or '—'}",
            "",
            "## Evidence",
        ]
        for e in ctx.evidence:
            state = "OCR indexed" if e.get("ocr_completed") else "OCR pending"
            lines.append(f"- {e.get('filename')} — {e.get('kind', 'file')} ({state})")
        if not ctx.evidence:
            lines.append("- (none attached)")
        lines += ["", "## Discussion"]
        for m in ctx.messages:
            who = m.get("sender") or "system"
            lines.append(f"- **{who}:** {m.get('content', '')}")
        if not ctx.messages:
            lines.append("- (no messages yet)")
        lines += ["", "## Open items", "- [ ] Review attached evidence", "- [ ] Confirm findings with the team", ""]
        return "\n".join(lines)
