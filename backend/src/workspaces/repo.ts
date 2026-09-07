import type { Workspace, WorkspaceMember, UserRole } from '@tolti/contracts';
import { query } from '../db/pool.js';

export async function listWorkspacesForUser(userId: string): Promise<Workspace[]> {
    const { rows } = await query<Workspace & { member_count: string }>(
        `SELECT w.*, COUNT(wm.user_id)::text AS member_count
           FROM workspaces w
           JOIN workspace_members wm ON wm.workspace_id = w.id
          WHERE w.id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $1)
          GROUP BY w.id
          ORDER BY w.created_at DESC`,
        [userId],
    );
    return rows;
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
    const { rows } = await query<Workspace>(`SELECT * FROM workspaces WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

export async function createWorkspace(input: {
    name: string;
    slug: string;
    description: string | null;
    created_by: string;
}): Promise<Workspace> {
    const { rows } = await query<Workspace>(
        `INSERT INTO workspaces (name, slug, description, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [input.name, input.slug, input.description, input.created_by],
    );
    const ws = rows[0]!;
    // Creator becomes an ADMIN member by default
    await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'ADMIN')`,
        [ws.id, input.created_by],
    );
    return ws;
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { rows } = await query<WorkspaceMember & { email: string; display_name: string }>(
        `SELECT wm.workspace_id, wm.user_id, wm.role, wm.joined_at,
                u.email, u.display_name
           FROM workspace_members wm
           JOIN users u ON u.id = wm.user_id
          WHERE wm.workspace_id = $1
          ORDER BY wm.joined_at ASC`,
        [workspaceId],
    );
    return rows.map((r) => ({
        workspace_id: r.workspace_id,
        user_id: r.user_id,
        role: r.role as UserRole,
        joined_at: r.joined_at,
        user: { id: r.user_id, email: r.email, display_name: r.display_name },
    }));
}

export async function addMember(input: {
    workspace_id: string;
    user_id: string;
    role: UserRole;
}): Promise<void> {
    await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3::user_role)
         ON CONFLICT DO NOTHING`,
        [input.workspace_id, input.user_id, input.role],
    );
}

export async function updateMember(input: {
    workspace_id: string;
    user_id: string;
    role: UserRole;
}): Promise<void> {
    await query(
        `UPDATE workspace_members SET role = $3::user_role
          WHERE workspace_id = $1 AND user_id = $2`,
        [input.workspace_id, input.user_id, input.role],
    );
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
    await query(
        `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId],
    );
}

export async function isMember(workspaceId: string, userId: string): Promise<boolean> {
    const { rows } = await query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2) AS exists`,
        [workspaceId, userId],
    );
    return !!rows[0]?.exists;
}
