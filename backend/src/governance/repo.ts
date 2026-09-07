import type { ModelConfig, ModelCapability, RoutingPolicy, AuditLogEntry, Notification } from '@tolti/contracts';
import { query } from '../db/pool.js';

export async function listModelConfigs(): Promise<ModelConfig[]> {
    const { rows } = await query<ModelConfig>(`SELECT * FROM model_configs ORDER BY capability, name`);
    return rows;
}

export async function getModelConfig(id: string): Promise<ModelConfig | null> {
    const { rows } = await query<ModelConfig>(`SELECT * FROM model_configs WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

export async function createModelConfig(input: {
    capability: ModelCapability;
    name: string;
    provider: string;
    base_url: string;
    api_key: string | null;
    model_id: string;
    is_default: boolean;
    settings: Record<string, unknown>;
}): Promise<ModelConfig> {
    if (input.is_default) {
        await query(
            `UPDATE model_configs SET is_default = FALSE WHERE capability = $1::model_capability`,
            [input.capability],
        );
    }
    const { rows } = await query<ModelConfig>(
        `INSERT INTO model_configs (capability, name, provider, base_url, api_key, model_id, is_default, settings)
         VALUES ($1::model_capability, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING *`,
        [
            input.capability,
            input.name,
            input.provider,
            input.base_url,
            input.api_key,
            input.model_id,
            input.is_default,
            JSON.stringify(input.settings ?? {}),
        ],
    );
    return rows[0]!;
}

export async function updateModelConfig(
    id: string,
    patch: {
        name?: string;
        base_url?: string;
        api_key?: string;
        model_id?: string;
        is_default?: boolean;
        settings?: Record<string, unknown>;
    },
): Promise<ModelConfig | null> {
    const existing = await getModelConfig(id);
    if (!existing) return null;
    if (patch.is_default) {
        await query(
            `UPDATE model_configs SET is_default = FALSE WHERE capability = $1::model_capability AND id <> $2`,
            [existing.capability, id],
        );
    }
    await query(
        `UPDATE model_configs SET
            name = COALESCE($2, name),
            base_url = COALESCE($3, base_url),
            api_key = COALESCE($4, api_key),
            model_id = COALESCE($5, model_id),
            is_default = COALESCE($6, is_default),
            settings = COALESCE($7::jsonb, settings)
          WHERE id = $1`,
        [
            id,
            patch.name ?? null,
            patch.base_url ?? null,
            patch.api_key ?? null,
            patch.model_id ?? null,
            patch.is_default ?? null,
            patch.settings ? JSON.stringify(patch.settings) : null,
        ],
    );
    return getModelConfig(id);
}

export async function deleteModelConfig(id: string): Promise<void> {
    await query(`DELETE FROM model_configs WHERE id = $1`, [id]);
}

// ── Routing policies ─────────────────────────────────────────

export async function listPolicies(): Promise<RoutingPolicy[]> {
    const { rows } = await query<RoutingPolicy>(`SELECT * FROM routing_policies ORDER BY created_at DESC`);
    return rows;
}

export async function createPolicy(input: { name: string; is_active: boolean; rules: any }): Promise<RoutingPolicy> {
    if (input.is_active) {
        await query(`UPDATE routing_policies SET is_active = FALSE`);
    }
    const { rows } = await query<RoutingPolicy>(
        `INSERT INTO routing_policies (name, is_active, rules)
         VALUES ($1, $2, $3::jsonb) RETURNING *`,
        [input.name, input.is_active, JSON.stringify(input.rules)],
    );
    return rows[0]!;
}

export async function updatePolicy(id: string, patch: { is_active?: boolean; rules?: any }): Promise<RoutingPolicy | null> {
    if (patch.is_active) await query(`UPDATE routing_policies SET is_active = FALSE WHERE id <> $1`, [id]);
    await query(
        `UPDATE routing_policies SET
            is_active = COALESCE($2, is_active),
            rules     = COALESCE($3::jsonb, rules)
          WHERE id = $1`,
        [id, patch.is_active ?? null, patch.rules ? JSON.stringify(patch.rules) : null],
    );
    const { rows } = await query<RoutingPolicy>(`SELECT * FROM routing_policies WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

export async function activatePolicy(id: string): Promise<RoutingPolicy | null> {
    await query(`UPDATE routing_policies SET is_active = FALSE WHERE id <> $1`, [id]);
    await query(`UPDATE routing_policies SET is_active = TRUE WHERE id = $1`, [id]);
    const { rows } = await query<RoutingPolicy>(`SELECT * FROM routing_policies WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

export async function deletePolicy(id: string): Promise<void> {
    await query(`DELETE FROM routing_policies WHERE id = $1`, [id]);
}

// ── Audit log query ──────────────────────────────────────────

export interface AuditQuery {
    workspace_id?: string;
    task_id?: string;
    actor_id?: string;
    event?: string;
    from?: string;
    to?: string;
    page?: number;
    page_size?: number;
}

export async function queryAudit(q: AuditQuery): Promise<{ items: AuditLogEntry[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (q.workspace_id) { params.push(q.workspace_id); where.push(`al.workspace_id = $${params.length}`); }
    if (q.task_id) { params.push(q.task_id); where.push(`al.task_id = $${params.length}`); }
    if (q.actor_id) { params.push(q.actor_id); where.push(`al.actor_id = $${params.length}`); }
    if (q.event) { params.push(q.event); where.push(`al.event = $${params.length}::audit_event_kind`); }
    if (q.from) { params.push(q.from); where.push(`al.created_at >= $${params.length}`); }
    if (q.to) { params.push(q.to); where.push(`al.created_at <= $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const page = Math.max(1, q.page ?? 1);
    const page_size = Math.min(200, q.page_size ?? 50);

    const totalRow = await query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM audit_logs al ${whereSql}`,
        params,
    );
    const { rows } = await query<AuditLogEntry & { actor_email: string | null; actor_name: string | null }>(
        `SELECT al.*, u.email AS actor_email, u.display_name AS actor_name
           FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
           ${whereSql}
          ORDER BY al.created_at DESC
          LIMIT ${page_size} OFFSET ${(page - 1) * page_size}`,
        params,
    );
    const items = rows.map((r) => ({
        ...r,
        actor: r.actor_id ? { id: r.actor_id, email: r.actor_email!, display_name: r.actor_name! } : null,
    })) as unknown as AuditLogEntry[];
    return { items, total: Number(totalRow.rows[0]?.total ?? 0) };
}

// ── Notifications ───────────────────────────────────────────

export async function listNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
    const { rows } = await query<Notification>(
        `SELECT * FROM notifications WHERE user_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''} ORDER BY created_at DESC LIMIT 200`,
        [userId],
    );
    return rows;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
    await query(
        `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2`,
        [id, userId],
    );
}

export async function notify(input: {
    user_id: string;
    workspace_id?: string | null;
    task_id?: string | null;
    kind: string;
    title: string;
    body?: string | null;
}): Promise<void> {
    await query(
        `INSERT INTO notifications (user_id, workspace_id, task_id, kind, title, body)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [input.user_id, input.workspace_id ?? null, input.task_id ?? null, input.kind, input.title, input.body ?? null],
    );
}
