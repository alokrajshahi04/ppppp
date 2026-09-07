import { z } from 'zod';
import { asUser, forbidden, notFound } from '../utils/errors.js';
import { parseBody, parseQuery } from '../utils/validation.js';
import {
    createModelConfig,
    createPolicy,
    deleteModelConfig,
    deletePolicy,
    listModelConfigs,
    listNotifications,
    listPolicies,
    activatePolicy,
    markNotificationRead,
    queryAudit,
    updateModelConfig,
    updatePolicy,
    type AuditQuery,
} from './repo.js';
import { audit } from './audit.js';
import type { UserRole } from '@tolti/contracts';

const ModelCapabilityEnum = z.enum(['OCR', 'VISION', 'TEXT', 'CODE', 'EMBEDDING']);

const CreateModelSchema = z.object({
    capability: ModelCapabilityEnum,
    name: z.string().min(1),
    provider: z.string().min(1),
    base_url: z.string().url(),
    api_key: z.string().optional(),
    model_id: z.string().min(1),
    is_default: z.boolean().optional(),
    settings: z.record(z.unknown()).optional(),
});

const UpdateModelSchema = z.object({
    name: z.string().optional(),
    base_url: z.string().url().optional(),
    api_key: z.string().optional(),
    model_id: z.string().optional(),
    is_default: z.boolean().optional(),
    settings: z.record(z.unknown()).optional(),
});

const CreatePolicySchema = z.object({
    name: z.string().min(1),
    is_active: z.boolean().optional(),
    rules: z.array(z.any()),
});

const UpdatePolicySchema = z.object({
    is_active: z.boolean().optional(),
    rules: z.array(z.any()).optional(),
});

const AuditQuerySchema = z.object({
    workspace_id: z.string().uuid().optional(),
    task_id: z.string().uuid().optional(),
    actor_id: z.string().uuid().optional(),
    event: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    page_size: z.coerce.number().int().min(1).max(200).optional(),
});

function requireAdmin(roles: UserRole[]) {
    if (!roles.includes('ADMIN')) throw forbidden('admin only');
}

export async function governanceRoutes(app: any): Promise<void> {
    app.addHook('preHandler', app.authenticate);

    // ── Models ──────────────────────────────────────────────
    app.get('/api/v1/models', async () => listModelConfigs());

    app.post('/api/v1/models', async (req: any, reply: any) => {
        const u = asUser(req);
        requireAdmin(u.system_roles as UserRole[]);
        const body = parseBody(CreateModelSchema, req.body);
        const created = await createModelConfig({
            capability: body.capability,
            name: body.name,
            provider: body.provider,
            base_url: body.base_url,
            api_key: body.api_key ?? null,
            model_id: body.model_id,
            is_default: body.is_default ?? false,
            settings: body.settings ?? {},
        });
        audit({ actor_id: u.sub, event: 'MODEL_CONFIG_CHANGED', target_id: created.id });
        return reply.status(201).send(created);
    });

    app.patch('/api/v1/models/:id', async (req: any) => {
        const u = asUser(req);
        requireAdmin(u.system_roles as UserRole[]);
        const { id } = req.params as { id: string };
        const body = parseBody(UpdateModelSchema, req.body);
        const updated = await updateModelConfig(id, body);
        if (!updated) throw notFound('model config not found');
        audit({ actor_id: u.sub, event: 'MODEL_CONFIG_CHANGED', target_id: id });
        return updated;
    });

    app.delete('/api/v1/models/:id', async (req: any) => {
        const u = asUser(req);
        requireAdmin(u.system_roles as UserRole[]);
        const { id } = req.params as { id: string };
        await deleteModelConfig(id);
        audit({ actor_id: u.sub, event: 'MODEL_CONFIG_CHANGED', target_id: id });
        return { ok: true };
    });

    // ── Routing policies ────────────────────────────────────
    app.get('/api/v1/routing-policies', async () => listPolicies());

    app.post('/api/v1/routing-policies', async (req: any, reply: any) => {
        const u = asUser(req);
        requireAdmin(u.system_roles as UserRole[]);
        const body = parseBody(CreatePolicySchema, req.body);
        const created = await createPolicy({ name: body.name, is_active: !!body.is_active, rules: body.rules });
        audit({ actor_id: u.sub, event: 'POLICY_CHANGED', target_id: created.id });
        return reply.status(201).send(created);
    });

    app.patch('/api/v1/routing-policies/:id', async (req: any) => {
        const u = asUser(req);
        requireAdmin(u.system_roles as UserRole[]);
        const { id } = req.params as { id: string };
        const body = parseBody(UpdatePolicySchema, req.body);
        const updated = await updatePolicy(id, body);
        if (!updated) throw notFound();
        audit({ actor_id: u.sub, event: 'POLICY_CHANGED', target_id: id });
        return updated;
    });

    app.post('/api/v1/routing-policies/:id/activate', async (req: any) => {
        const u = asUser(req);
        requireAdmin(u.system_roles as UserRole[]);
        const { id } = req.params as { id: string };
        const updated = await activatePolicy(id);
        if (!updated) throw notFound();
        audit({ actor_id: u.sub, event: 'POLICY_CHANGED', target_id: id });
        return updated;
    });

    app.delete('/api/v1/routing-policies/:id', async (req: any) => {
        const u = asUser(req);
        requireAdmin(u.system_roles as UserRole[]);
        const { id } = req.params as { id: string };
        await deletePolicy(id);
        audit({ actor_id: u.sub, event: 'POLICY_CHANGED', target_id: id });
        return { ok: true };
    });

    // ── Audit ───────────────────────────────────────────────
    app.get('/api/v1/audit', async (req: any) => {
        const u = asUser(req);
        const roles = u.system_roles as UserRole[];
        if (!roles.includes('ADMIN') && !roles.includes('SECURITY_APPROVER')) {
            throw forbidden('admin or security approver only');
        }
        const q = parseQuery(AuditQuerySchema, req.query) as AuditQuery;
        return queryAudit(q);
    });

    // ── Notifications ───────────────────────────────────────
    app.get('/api/v1/notifications', async (req: any) => {
        const u = asUser(req);
        const unreadOnly = (req.query as { unread?: string }).unread === 'true';
        return listNotifications(u.sub, unreadOnly);
    });

    app.post('/api/v1/notifications/:id/read', async (req: any) => {
        const u = asUser(req);
        const { id } = req.params as { id: string };
        await markNotificationRead(id, u.sub);
        return { ok: true };
    });
}
