"""Email automation — sends a room summary via SMTP.

Real send when SMTP_* env vars are configured; otherwise raises a clear,
actionable error (surfaced in the UI as a configuration state, not a crash).
"""

from __future__ import annotations

import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Any, ClassVar

from app.automations.base import Automation, AutomationContext, AutomationParam
from app.config import get_settings


class EmailSummaryAutomation(Automation):
    id = "email_summary"
    title = "Email the room summary"
    description = "Compiles what happened in this room and emails it to a teammate or stakeholder."
    keywords: ClassVar[list[str]] = [
        "email the summary", "email summary", "email this summary",
        "send the summary by email", "email the room summary",
    ]
    params: ClassVar[list[AutomationParam]] = [
        AutomationParam(name="to", label="Send to (email)", required=True, placeholder="name@company.com"),
    ]

    async def run(self, ctx: AutomationContext, **kwargs: Any) -> dict:
        to = (kwargs.get("to") or "").strip()
        if not to or "@" not in to:
            return {"ok": False, "error": "A valid recipient email is required.", "needs_param": "to"}

        settings = get_settings()
        if not settings.smtp_host:
            return {
                "ok": False,
                "error": "SMTP is not configured on this deployment.",
                "hint": "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in the deployment environment to enable outgoing email.",
            }

        subject = f"[Tolti] Summary — {ctx.room_title}"
        body = self._compose(ctx)

        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = formataddr(("Tolti AI", settings.smtp_from or settings.smtp_user or "tolti@localhost"))
        msg["To"] = to

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_pass or "")
            smtp.sendmail(msg["From"], [to], msg.as_string())

        return {
            "ok": True,
            "summary": f"Emailed the room summary to {to}.",
            "details": {"to": to, "subject": subject},
        }

    @staticmethod
    def _compose(ctx: AutomationContext) -> str:
        lines = [
            f"Room: {ctx.room_title}",
            f"Driver: {ctx.driver_name}",
            "",
            f"Evidence attached ({len(ctx.evidence)}):",
        ]
        for e in ctx.evidence[:10]:
            lines.append(f"  • {e.get('filename')} ({e.get('kind', 'file')}, OCR {'done' if e.get('ocr_completed') else 'pending'})")
        if not ctx.evidence:
            lines.append("  • (none)")
        lines.append("")
        lines.append(f"Recent messages ({len(ctx.messages)}):")
        for m in ctx.messages[-10:]:
            who = m.get("sender") or "system"
            content = (m.get("content") or "").replace("\n", " ")[:160]
            lines.append(f"  • {who}: {content}")
        lines.append("")
        lines.append("— Sent by Tolti AI (on-premise, sovereign deployment)")
        return "\n".join(lines)
