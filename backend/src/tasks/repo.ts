import type { Task, TaskStatus, TaskPriority, Evidence, UUID } from '@tolti/contracts';
import { query } from '../db/pool.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guard: never hand a non-UUID to Postgres (it throws instead of 404-ing). */
function safeId(id: string | undefined | null): string | null {
    return id && UUID_RE.test(id) ? id : null;
}

export interface TaskFilters {
    workspace_id?: UUID;
    status?: TaskStatus;
    priority?: TaskPriority;
    driver_id?: UUID;
    q?: string;
    page?: number;
    page_size?: number;
}

export interface CallerContext {
    sub: string;
    isAdmin: boolean;
}

export async function listTasks(
    f: TaskFilters,
    caller: CallerContext,
): Promise<{ items: Task[]; total: number }> {
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
    if (f.q) {
        params.push(`%${f.q}%`, `%${f.q}%`);
        const a = params.length - 1;
        const b = params.length;
        where.push(`(t.title ILIKE $${a} OR t.description ILIKE $${b})`);
    }

    // Visibility model:
    //  - system ADMIN sees everything (audit mandate)
    //  - PRIVATE rooms: driver only
    //  - SHARED rooms: any workspace member who is the driver OR has been
    //    invited (task_members); workspace membership is the outer boundary.
    if (!caller.isAdmin) {
        params.push(caller.sub);
        const me = params.length;
        where.push(`(
            t.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $${me})
            AND (
                (t.kind = 'PRIVATE' AND t.driver_id = $${me})
                OR (t.kind = 'SHARED' AND (
                    t.driver_id = $${me}
                    OR EXISTS (SELECT 1 FROM task_members tm WHERE tm.task_id = t.id AND tm.user_id = $${me})
                ))
            )
        )`);
    }

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
    const safe = safeId(id);
    if (!safe) return null;
    const { rows } = await query<Task>(
        `SELECT * FROM tasks WHERE id = $1`,
        [safe],
    );
    return rows[0] ?? null;
}

export async function createTask(input: {
    workspace_id: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    kind: Task['kind'];
    driver_id: string;
}): Promise<Task> {
    const { rows } = await query<Task>(
        `INSERT INTO tasks (workspace_id, title, description, priority, kind, driver_id, status)
         VALUES ($1, $2, $3, $4::task_priority, $5::task_kind, $6, 'OPEN') RETURNING *`,
        [input.workspace_id, input.title, input.description, input.priority, input.kind, input.driver_id],
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

export async function handOff(taskId: string, fromUserId: string, toUserId: string): Promise<Task | null> {
    await query(
        `UPDATE tasks
            SET driver_id = $2,
                handed_off_to = $3
          WHERE id = $1`,
        [taskId, toUserId, fromUserId],
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
        // bigint columns come back as strings from pg; the contract says number.
        byte_size: Number(r.byte_size),
        uploader: { id: r.uploaded_by, display_name: r.uploader_name },
    })) as unknown as Evidence[];
}

export async function getEvidence(id: string): Promise<Evidence | null> {
    const safe = safeId(id);
    if (!safe) return null;
    const { rows } = await query<Evidence>(`SELECT * FROM evidence WHERE id = $1`, [safe]);
    const ev = rows[0];
    if (!ev) return null;
    // bigint columns come back as strings from pg; the contract says number.
    return { ...ev, byte_size: Number(ev.byte_size) };
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

// ── Room (task) membership ───────────────────────────────────────

export interface TaskMemberRow {
    user_id: string;
    display_name: string;
    email: string;
    is_driver: boolean;
    added_at: string;
}

export async function isTaskMember(taskId: string, userId: string): Promise<boolean> {
    const { rows } = await query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM task_members WHERE task_id = $1 AND user_id = $2) AS exists`,
        [taskId, userId],
    );
    return !!rows[0]?.exists;
}

export async function listTaskMembers(taskId: string): Promise<TaskMemberRow[]> {
    const { rows } = await query<TaskMemberRow>(
        `SELECT u.id AS user_id, u.display_name, u.email, (u.id = t.driver_id) AS is_driver,
                COALESCE(tm.added_at, t.created_at) AS added_at
           FROM tasks t
           JOIN users u ON u.id = t.driver_id
           LEFT JOIN task_members tm ON tm.task_id = t.id AND tm.user_id = u.id
          WHERE t.id = $1
          UNION
         SELECT u.id, u.display_name, u.email, FALSE, tm.added_at
           FROM task_members tm
           JOIN users u ON u.id = tm.user_id
           JOIN tasks t ON t.id = tm.task_id
          WHERE tm.task_id = $1
          ORDER BY is_driver DESC, added_at ASC`,
        [taskId],
    );
    return rows;
}

export async function addTaskMember(input: {
    task_id: string;
    user_id: string;
    added_by: string;
}): Promise<boolean> {
    const { rowCount } = await query(
        `INSERT INTO task_members (task_id, user_id, added_by)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [input.task_id, input.user_id, input.added_by],
    );
    return (rowCount ?? 0) > 0;
}

export async function removeTaskMember(taskId: string, userId: string): Promise<void> {
    await query(`DELETE FROM task_members WHERE task_id = $1 AND user_id = $2`, [taskId, userId]);
}
