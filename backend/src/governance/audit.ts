import { query } from '../db/pool.js';
import type { AuditEventKind } from '@tolti/contracts';

interface AuditInput {
    actor_id?: string | null;
    workspace_id?: string | null;
    task_id?: string | null;
    event: AuditEventKind;
    target_type?: string | null;
    target_id?: string | null;
    payload?: Record<string, unknown>;
    ip_address?: string | null;
    user_agent?: string | null;
}

export async function audit(input: AuditInput): Promise<void> {
    try {
        await query(
            `INSERT INTO audit_logs
                (actor_id, workspace_id, task_id, event, target_type, target_id, payload, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::inet, $9)`,
            [
                input.actor_id ?? null,
                input.workspace_id ?? null,
                input.task_id ?? null,
                input.event,
                input.target_type ?? null,
                input.target_id ?? null,
                JSON.stringify(input.payload ?? {}),
                input.ip_address ?? null,
                input.user_agent ?? null,
            ],
        );
    } catch (err) {
        // Audit logging must never block the request — swallow + log.
        // eslint-disable-next-line no-console
        console.error('audit.failed', err);
    }
}

export function auditFromRequest(req: any) {
    return {
        ip_address: req?.ip ?? null,
        user_agent: req?.headers?.['user-agent'] ?? null,
    };
}
