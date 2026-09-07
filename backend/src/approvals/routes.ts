import { z } from 'zod';
import {
    createApproval,
    decideApproval,
    getApproval,
    listApprovals,
} from './repo.js';
import { asUser, forbidden, notFound } from '../utils/errors.js';
import { parseBody, parseQuery } from '../utils/validation.js';
import { getTask } from '../tasks/repo.js';
import { isMember } from '../workspaces/repo.js';
import { broadcastTaskEvent } from '../rooms/broadcaster.js';
import { audit } from '../governance/audit.js';
import type { UserRole } from '@tolti/contracts';

const CreateSchema = z.object({
    task_id: z.string().uuid(),
    kind: z.enum(['OUTPUT', 'ACTION', 'REPORT', 'SENSITIVE_FINDING']),
    target_id: z.string().uuid().optional(),
    summary: z.string().min(1),
    reason: z.string().optional(),
});

const DecideSchema = z.object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().optional(),
});

const ListQuerySchema = z.object({
    task_id: z.string().uuid().optional(),
    state: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REVOKED']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    page_size: z.coerce.number().int().min(1).max(100).optional(),
});

export async function approvalRoutes(app: any): Promise<void> {
    app.addHook('preHandler', app.authenticate);

    app.get('/api/v1/approvals', async (req: any) => {
        const q = parseQuery(ListQuerySchema, req.query);
        return listApprovals(q);
    });

    app.post('/api/v1/approvals', async (req: any, reply: any) => {
        const u = asUser(req);
        const body = parseBody(CreateSchema, req.body);
        const task = await getTask(body.task_id);
        if (!task) throw notFound();
        if (!(await isMember(task.workspace_id, u.sub))) throw forbidden();
        const created = await createApproval({
            task_id: body.task_id,
            requested_by: u.sub,
            kind: body.kind,
            target_id: body.target_id ?? null,
            summary: body.summary,
            reason: body.reason ?? null,
        });
        audit({
            actor_id: u.sub,
            event: 'APPROVAL_REQUESTED',
            task_id: body.task_id,
            workspace_id: task.workspace_id,
            target_id: created.id,
        });
        broadcastTaskEvent(body.task_id, { type: 'approval:requested', payload: { approval: created } });
        return reply.status(201).send(created);
    });

    app.get('/api/v1/approvals/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const approval = await getApproval(id);
        if (!approval) throw notFound();
        return approval;
    });

    app.post('/api/v1/approvals/:id/decide', async (req: any) => {
        const u = asUser(req);
        const { id } = req.params as { id: string };
        const body = parseBody(DecideSchema, req.body);
        const approval = await getApproval(id);
        if (!approval) throw notFound();
        const task = await getTask(approval.task_id);
        if (!task || !(await isMember(task.workspace_id, u.sub))) throw forbidden();
        const roles = u.system_roles as UserRole[];
        if (!roles.includes('SECURITY_APPROVER') && !roles.includes('ADMIN')) {
            throw forbidden('security approver or admin only');
        }
        const decided = await decideApproval(id, u.sub, body.decision, body.reason ?? null);
        audit({
            actor_id: u.sub,
            event: body.decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
            task_id: approval.task_id,
            workspace_id: task.workspace_id,
            target_id: id,
            payload: { reason: body.reason ?? null },
        });
        if (decided) broadcastTaskEvent(approval.task_id, { type: 'approval:decided', payload: { approval: decided } });
        return decided;
    });
}
