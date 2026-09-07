import type { Task, TaskStatus, TaskPriority, Evidence, UUID } from '@tolti/contracts';
import { query } from '../db/pool.js';

export interface TaskFilters {
    workspace_id?: UUID;
    status?: TaskStatus;
    priority?: TaskPriority;
    driver_id?: UUID;
    q?: string;
    page?: number;
    page_size?: number;
}

export async function listTasks(f: TaskFilters): Promise<{ items: Task[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
        params.push(value);
        where.push(clause.replace('?', `$${params.length}`));
    };
    if (f.workspace_id) push('t.workspace_id = ?', f.workspace_id);
    if (f.status) push('t.status = ?::task_status', f.status);
    if (f.priority) push('t.priority = ?::task_priority', f.priority);
    if (f.driver_id) push('t.driver_id = ?', f.driver_id);
    if (f.q) push('(t.title ILIKE ? OR t.description ILIKE ?)', `%${f.q}%`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const page = Math.max(1, f.page ?? 1);
    const page_size = Math.min(100, Math.max(1, f.page_size ?? 20));
    const offset = (page - 1) * page_size;

    const totalRow = await query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM tasks t ${whereSql}`,
        params,
    );
    const rows = await query<Task & { evidence_count: string; message_count: string }>(
        `SELECT t.*,
                (SELECT COUNT(*) FROM evidence WHERE task_id = t.id)::text AS evidence_count,
                (SELECT COUNT(*) FROM messages WHERE task_id = t.id)::text AS message_count
           FROM tasks t
           ${whereSql}
          ORDER BY t.updated_at DESC
          LIMIT ${page_size} OFFSET ${offset}`,
        params,
    );

    return {
        items: rows.rows.map((r) => ({
            ...r,
            evidence_count: Number(r.evidence_count ?? 0),
            message_count: Number(r.message_count ?? 0),
        })) as Task[],
        total: Number(totalRow.rows[0]?.total ?? 0),
    };
}

export async function getTask(id: string): Promise<Task | null> {
    const { rows } = await query<Task>(
        `SELECT * FROM tasks WHERE id = $1`,
        [id],
    );
    return rows[0] ?? null;
}

export async function createTask(input: {
    workspace_id: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    driver_id: string;
}): Promise<Task> {
    const { rows } = await query<Task>(
        `INSERT INTO tasks (workspace_id, title, description, priority, driver_id, status)
         VALUES ($1, $2, $3, $4::task_priority, $5, 'OPEN') RETURNING *`,
        [input.workspace_id, input.title, input.description, input.priority, input.driver_id],
    );
    return rows[0]!;
}

export async function updateTask(
    id: string,
    patch: { title?: string; description?: string; status?: TaskStatus; priority?: TaskPriority },
): Promise<Task | null> {
    await query(
        `UPDATE tasks SET
            title       = COALESCE($2, title),
            description = COALESCE($3, description),
            status      = COALESCE($4::task_status, status),
            priority    = COALESCE($5::task_priority, priority),
            completed_at = CASE
                WHEN $4::task_status = 'COMPLETED' AND completed_at IS NULL THEN NOW()
                WHEN $4::task_status IS NOT NULL AND $4::task_status <> 'COMPLETED' THEN NULL
                ELSE completed_at
            END
          WHERE id = $1`,
        [id, patch.title ?? null, patch.description ?? null, patch.status ?? null, patch.priority ?? null],
    );
    return getTask(id);
}

export async function handOff(taskId: string, toUserId: string): Promise<Task | null> {
    await query(
        `UPDATE tasks SET handed_off_to = $2 WHERE id = $1`,
        [taskId, toUserId],
    );
    return getTask(taskId);
}

export async function listEvidence(taskId: string): Promise<Evidence[]> {
    const { rows } = await query<Evidence & { uploader_email: string; uploader_name: string }>(
        `SELECT e.*, u.email AS uploader_email, u.display_name AS uploader_name
           FROM evidence e JOIN users u ON u.id = e.uploaded_by
          WHERE e.task_id = $1 ORDER BY e.uploaded_at DESC`,
        [taskId],
    );
    return rows.map((r) => ({
        ...r,
        uploader: { id: r.uploaded_by, display_name: r.uploader_name },
    })) as unknown as Evidence[];
}

export async function getEvidence(id: string): Promise<Evidence | null> {
    const { rows } = await query<Evidence>(`SELECT * FROM evidence WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

export async function createEvidenceRecord(input: {
    task_id: string;
    uploaded_by: string;
    kind: Evidence['kind'];
    filename: string;
    mime_type: string;
    byte_size: number;
    storage_key: string;
    checksum_sha256: string | null;
    metadata: Record<string, unknown>;
}): Promise<Evidence> {
    const { rows } = await query<Evidence>(
        `INSERT INTO evidence
            (task_id, uploaded_by, kind, filename, mime_type, byte_size, storage_key, checksum_sha256, metadata)
         VALUES ($1,$2,$3::evidence_kind,$4,$5,$6,$7,$8,$9::jsonb)
         RETURNING *`,
        [
            input.task_id,
            input.uploaded_by,
            input.kind,
            input.filename,
            input.mime_type,
            input.byte_size,
            input.storage_key,
            input.checksum_sha256,
            JSON.stringify(input.metadata ?? {}),
        ],
    );
    return rows[0]!;
}

export async function deleteEvidence(id: string): Promise<void> {
    await query(`DELETE FROM evidence WHERE id = $1`, [id]);
}

export async function setEvidenceOcrText(id: string, text: string): Promise<void> {
    await query(
        `UPDATE evidence SET ocr_text = $2, ocr_completed = TRUE WHERE id = $1`,
        [id, text],
    );
}
