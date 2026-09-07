import { query } from '../db/pool.js';
import type { PresenceEntry, PresenceStatus } from '@tolti/contracts';

export async function getTaskPresence(taskId: string): Promise<PresenceEntry[]> {
    const { rows } = await query<PresenceEntry>(
        `SELECT p.user_id, u.display_name, wm.role::text AS role, p.status, p.last_seen
           FROM presence p
           JOIN users u ON u.id = p.user_id
           LEFT JOIN workspace_members wm ON wm.user_id = p.user_id
          WHERE p.task_id = $1
          ORDER BY p.last_seen DESC`,
        [taskId],
    );
    return rows;
}

export async function setPresence(taskId: string, userId: string, status: PresenceStatus): Promise<void> {
    await query(
        `INSERT INTO presence (task_id, user_id, status, last_seen)
         VALUES ($1, $2, $3::presence_status, NOW())
         ON CONFLICT (task_id, user_id) DO UPDATE SET
            status = EXCLUDED.status,
            last_seen = NOW()`,
        [taskId, userId, status],
    );
}
