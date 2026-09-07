import type { Approval, ApprovalKind, ApprovalState } from '@tolti/contracts';
import { query } from '../db/pool.js';

export async function listApprovals(filters: {
    task_id?: string;
    state?: ApprovalState;
    requested_by?: string;
    page?: number;
    page_size?: number;
}): Promise<{ items: Approval[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.task_id) {
        params.push(filters.task_id);
        where.push(`a.task_id = $${params.length}`);
    }
    if (filters.state) {
        params.push(filters.state);
        where.push(`a.state = $${params.length}::approval_state`);
    }
    if (filters.requested_by) {
        params.push(filters.requested_by);
        where.push(`a.requested_by = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const page = Math.max(1, filters.page ?? 1);
    const page_size = Math.min(100, filters.page_size ?? 20);

    const totalRow = await query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM approvals a ${whereSql}`,
        params,
    );

    const { rows } = await query<Approval & { requester_name: string; decider_name: string | null }>(
        `SELECT a.*,
                ru.display_name AS requester_name,
                du.display_name AS decider_name
           FROM approvals a
           JOIN users ru ON ru.id = a.requested_by
           LEFT JOIN users du ON du.id = a.decided_by
           ${whereSql}
          ORDER BY a.requested_at DESC
          LIMIT ${page_size} OFFSET ${(page - 1) * page_size}`,
        params,
    );
    const items = rows.map((r) => ({
        ...r,
        requester: { id: r.requested_by, display_name: r.requester_name },
        decider: r.decided_by && r.decider_name ? { id: r.decided_by, display_name: r.decider_name } : null,
    })) as unknown as Approval[];
    return { items, total: Number(totalRow.rows[0]?.total ?? 0) };
}

export async function getApproval(id: string): Promise<Approval | null> {
    const { rows } = await query<Approval>(`SELECT * FROM approvals WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

export async function createApproval(input: {
    task_id: string;
    requested_by: string;
    kind: ApprovalKind;
    target_id: string | null;
    summary: string;
    reason: string | null;
}): Promise<Approval> {
    const { rows } = await query<Approval>(
        `INSERT INTO approvals (task_id, requested_by, kind, target_id, summary, reason)
         VALUES ($1, $2, $3::approval_kind, $4, $5, $6) RETURNING *`,
        [input.task_id, input.requested_by, input.kind, input.target_id, input.summary, input.reason],
    );
    return rows[0]!;
}

export async function decideApproval(
    id: string,
    decidedBy: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string | null,
): Promise<Approval | null> {
    await query(
        `UPDATE approvals SET
            state = $2::approval_state,
            decided_by = $3,
            reason = COALESCE($4, reason),
            decided_at = NOW()
          WHERE id = $1`,
        [id, decision, decidedBy, reason],
    );
    return getApproval(id);
}
