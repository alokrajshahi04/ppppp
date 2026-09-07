import { z } from 'zod';
import type { CreateUserRequest, UpdateUserRequest, UserRole } from '@tolti/contracts';
import {
    createUser,
    findUserById,
    listUsers,
    updateUser,
} from '../users/repo.js';
import { hashPassword } from './password.js';
import { parseBody } from '../utils/validation.js';
import { asUser, conflict, notFound } from '../utils/errors.js';
import { hasPermission } from '../rbac/permissions.js';
import { audit } from '../governance/audit.js';

const CreateUserSchema = z.object({
    email: z.string().email(),
    display_name: z.string().min(1),
    password: z.string().min(8),
    system_roles: z.array(
        z.enum(['ADMIN', 'DRIVER', 'REVIEWER', 'WATCHER', 'SECURITY_APPROVER']),
    ),
}) satisfies z.ZodType<CreateUserRequest & { password: string }>;

const UpdateUserSchema = z.object({
    display_name: z.string().min(1).optional(),
    is_active: z.boolean().optional(),
    system_roles: z.array(
        z.enum(['ADMIN', 'DRIVER', 'REVIEWER', 'WATCHER', 'SECURITY_APPROVER']),
    ).optional(),
}) satisfies z.ZodType<UpdateUserRequest>;

export async function userRoutes(app: any): Promise<void> {
    app.addHook('preHandler', app.authenticate);

    app.get('/api/v1/users', async (req: any) => {
        const u = asUser(req);
        if (!hasPermission(u.system_roles as UserRole[], 'user.read') && !hasPermission(u.system_roles as UserRole[], '*')) {
            // Allow any authenticated user to read their own workspace's user list — but
            // for now, only ADMIN/SECURITY_APPROVER can see the full directory.
            if (
                !hasPermission(u.system_roles as UserRole[], 'audit.read') &&
                !(u.system_roles as UserRole[]).includes('ADMIN')
            ) {
                // fall through to a minimal list of self
            }
        }
        if ((u.system_roles as UserRole[]).includes('ADMIN')) {
            return listUsers();
        }
        // Non-admins only see themselves
        const me = await findUserById(u.sub);
        return me ? [me] : [];
    });

    app.post('/api/v1/users', async (req: any, reply: any) => {
        const u = asUser(req);
        if (!(u.system_roles as UserRole[]).includes('ADMIN')) {
            throw (await import('../utils/errors.js')).forbidden('admin only');
        }
        const body = parseBody(CreateUserSchema, req.body);
        try {
            const created = await createUser({
                email: body.email,
                display_name: body.display_name,
                password_hash: await hashPassword(body.password),
                system_roles: body.system_roles,
            });
            audit({ actor_id: u.sub, event: 'USER_CREATED', target_id: created.id });
            return reply.status(201).send(created);
        } catch (e: unknown) {
            if ((e as { code?: string }).code === '23505') {
                throw conflict('email already exists');
            }
            throw e;
        }
    });

    app.get('/api/v1/users/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const user = await findUserById(id);
        if (!user) throw notFound('user not found');
        return user;
    });

    app.patch('/api/v1/users/:id', async (req: any) => {
        const u = asUser(req);
        if (!(u.system_roles as UserRole[]).includes('ADMIN')) {
            throw (await import('../utils/errors.js')).forbidden('admin only');
        }
        const { id } = req.params as { id: string };
        const body = parseBody(UpdateUserSchema, req.body);
        const updated = await updateUser(id, body);
        if (!updated) throw notFound('user not found');
        audit({ actor_id: u.sub, event: 'USER_UPDATED', target_id: id });
        return updated;
    });

    app.delete('/api/v1/users/:id', async (req: any, reply: any) => {
        const u = asUser(req);
        if (!(u.system_roles as UserRole[]).includes('ADMIN')) {
            throw (await import('../utils/errors.js')).forbidden('admin only');
        }
        const { id } = req.params as { id: string };
        const updated = await updateUser(id, { is_active: false });
        audit({ actor_id: u.sub, event: 'USER_DELETED', target_id: id });
        return reply.send(updated);
    });
}
