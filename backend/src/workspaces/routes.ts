import { z } from 'zod';
import {
    addMember,
    createWorkspace,
    getWorkspace,
    isMember,
    listMembers,
    listWorkspacesForUser,
    removeMember,
    updateMember,
} from './repo.js';
import { asUser, badRequest, forbidden, notFound } from '../utils/errors.js';
import { parseBody } from '../utils/validation.js';
import { audit } from '../governance/audit.js';
import type { UserRole } from '@tolti/contracts';

const CreateSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    description: z.string().optional(),
});

const UpdateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
});

const AddMemberSchema = z.object({
    user_id: z.string().uuid(),
    role: z.enum(['ADMIN', 'DRIVER', 'REVIEWER', 'WATCHER', 'SECURITY_APPROVER']),
});

const UpdateMemberSchema = AddMemberSchema.pick({ role: true });

async function ensureMember(workspaceId: string, userId: string) {
    if (!(await isMember(workspaceId, userId))) throw forbidden('not a member of this workspace');
}

export async function workspaceRoutes(app: any): Promise<void> {
    app.addHook('preHandler', app.authenticate);

    app.get('/api/v1/workspaces', async (req: any) => {
        const u = asUser(req);
        return listWorkspacesForUser(u.sub);
    });

    app.post('/api/v1/workspaces', async (req: any, reply: any) => {
        const u = asUser(req);
        if (!(u.system_roles as UserRole[]).includes('ADMIN')) throw forbidden('admin only');
        const body = parseBody(CreateSchema, req.body);
        try {
            const ws = await createWorkspace({
                name: body.name,
                slug: body.slug,
                description: body.description ?? null,
                created_by: u.sub,
            });
            audit({ actor_id: u.sub, event: 'WORKSPACE_CREATED', target_id: ws.id, workspace_id: ws.id });
            return reply.status(201).send(ws);
        } catch (e: unknown) {
            if ((e as { code?: string }).code === '23505') throw badRequest('slug already exists');
            throw e;
        }
    });

    app.get('/api/v1/workspaces/:id', async (req: any) => {
        const u = asUser(req);
        const { id } = req.params as { id: string };
        await ensureMember(id, u.sub);
        const ws = await getWorkspace(id);
        if (!ws) throw notFound('workspace not found');
        return ws;
    });

    app.patch('/api/v1/workspaces/:id', async (req: any) => {
        const u = asUser(req);
        const { id } = req.params as { id: string };
        await ensureMember(id, u.sub);
        if (!(u.system_roles as UserRole[]).includes('ADMIN')) throw forbidden('admin only');
        const body = parseBody(UpdateSchema, req.body);
        // simple update
        const { query } = await import('../db/pool.js');
        await query(
            `UPDATE workspaces SET
                name = COALESCE($2, name),
                description = COALESCE($3, description)
              WHERE id = $1`,
            [id, body.name ?? null, body.description ?? null],
        );
        const ws = await getWorkspace(id);
        audit({ actor_id: u.sub, event: 'WORKSPACE_UPDATED', workspace_id: id });
        return ws;
    });

    app.get('/api/v1/workspaces/:id/members', async (req: any) => {
        const u = asUser(req);
        const { id } = req.params as { id: string };
        await ensureMember(id, u.sub);
        return listMembers(id);
    });

    app.post('/api/v1/workspaces/:id/members', async (req: any) => {
        const u = asUser(req);
        const { id } = req.params as { id: string };
        await ensureMember(id, u.sub);
        if (!(u.system_roles as UserRole[]).includes('ADMIN')) throw forbidden('admin only');
        const body = parseBody(AddMemberSchema, req.body);
        await addMember({ workspace_id: id, user_id: body.user_id, role: body.role });
        audit({ actor_id: u.sub, event: 'MEMBER_ADDED', workspace_id: id, target_id: body.user_id });
        return { ok: true };
    });

    app.patch('/api/v1/workspaces/:id/members/:userId', async (req: any) => {
        const u = asUser(req);
        const { id, userId } = req.params as { id: string; userId: string };
        await ensureMember(id, u.sub);
        if (!(u.system_roles as UserRole[]).includes('ADMIN')) throw forbidden('admin only');
        const body = parseBody(UpdateMemberSchema, req.body);
        await updateMember({ workspace_id: id, user_id: userId, role: body.role });
        audit({ actor_id: u.sub, event: 'ROLE_CHANGED', workspace_id: id, target_id: userId });
        return { ok: true };
    });

    app.delete('/api/v1/workspaces/:id/members/:userId', async (req: any) => {
        const u = asUser(req);
        const { id, userId } = req.params as { id: string; userId: string };
        await ensureMember(id, u.sub);
        if (!(u.system_roles as UserRole[]).includes('ADMIN')) throw forbidden('admin only');
        await removeMember(id, userId);
        audit({ actor_id: u.sub, event: 'MEMBER_REMOVED', workspace_id: id, target_id: userId });
        return { ok: true };
    });
}
