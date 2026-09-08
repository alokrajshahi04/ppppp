import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import type { Task } from '@tolti/contracts';
import {
    createEvidenceRecord,
    createTask,
    deleteEvidence,
    getEvidence,
    getTask,
    handOff,
    listEvidence,
    listTasks,
    setEvidenceOcrText,
    updateTask,
    type TaskFilters,
} from './repo.js';
import { asUser, badRequest, forbidden, notFound } from '../utils/errors.js';
import { parseBody, parseQuery } from '../utils/validation.js';
import { isMember } from '../workspaces/repo.js';
import { requireTaskAccess } from './access.js';
import { isTaskMember, listTaskMembers, addTaskMember, removeTaskMember } from './repo.js';
import { query } from '../db/pool.js';
import { notify } from '../governance/repo.js';
import { presignedGetUrl, presignedPutUrl, ensureBucket, deleteObject, putObject } from '../evidence/storage.js';
import { indexEvidence, ocr as aiOcr } from '../ai/client.js';
import { broadcastTaskEvent } from '../rooms/broadcaster.js';
import { audit } from '../governance/audit.js';
import type { UserRole } from '@tolti/contracts';

const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const TaskStatusEnum = z.enum([
    'DRAFT',
    'OPEN',
    'IN_PROGRESS',
    'AWAITING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'COMPLETED',
    'ARCHIVED',
]);

const EvidenceKindEnum = z.enum(['PDF', 'IMAGE', 'DIAGRAM', 'TEXT', 'CODE', 'OTHER']);

const CreateTaskSchema = z.object({
    workspace_id: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional(),
    priority: TaskPriorityEnum.optional(),
    kind: z.enum(['SHARED', 'PRIVATE']).optional(),
});

const UpdateTaskSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
});

const HandOffSchema = z.object({
    to_user_id: z.string().uuid(),
    note: z.string().optional(),
});

const ListTasksQuerySchema = z.object({
    workspace_id: z.string().uuid().optional(),
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    driver_id: z.string().uuid().optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    page_size: z.coerce.number().int().min(1).max(100).optional(),
});

const EvidenceUploadSchema = z.object({
    // task_id comes from the URL param; kept optional for backwards compat.
    task_id: z.string().uuid().optional(),
    kind: EvidenceKindEnum,
    filename: z.string().min(1),
    mime_type: z.string().min(1),
    byte_size: z.coerce.number().int().positive(),
    checksum_sha256: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
});

/** Room driver or a workspace ADMIN may manage room members. */
async function canManageMembers(task: Task, u: { sub: string; system_roles: string[] }): Promise<boolean> {
    if (task.driver_id === u.sub || u.system_roles.includes('ADMIN')) return true;
    const { rowCount } = await query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND role = 'ADMIN'`,
        [task.workspace_id, u.sub],
    );
    return (rowCount ?? 0) > 0;
}

export async function taskRoutes(app: any): Promise<void> {
    app.addHook('preHandler', app.authenticate);

    // ── Tasks ────────────────────────────────────────────────
    app.get('/api/v1/tasks', async (req: any) => {
        const filters = parseQuery(ListTasksQuerySchema, req.query) as TaskFilters;
        const u = asUser(req);
        if (filters.workspace_id) {
            if (!(await isMember(filters.workspace_id, u.sub))) throw forbidden();
        }
        const isAdmin = (u.system_roles as UserRole[]).includes('ADMIN');
        return listTasks(filters, { sub: u.sub, isAdmin });
    });

    app.post('/api/v1/tasks', async (req: any, reply: any) => {
        const body = parseBody(CreateTaskSchema, req.body);
        const u = asUser(req);
        if (!(await isMember(body.workspace_id, u.sub))) throw forbidden();
        const task = await createTask({
            workspace_id: body.workspace_id,
            title: body.title,
            description: body.description ?? null,
            priority: body.priority ?? 'MEDIUM',
            kind: body.kind ?? 'SHARED',
            driver_id: u.sub,
        });
        audit({ actor_id: u.sub, event: 'TASK_CREATED', task_id: task.id, workspace_id: task.workspace_id });
        broadcastTaskEvent(task.id, { type: 'task:state', payload: { task } });
        return reply.status(201).send(task);
    });

    app.get('/api/v1/tasks/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        return requireTaskAccess(id, u);
    });

    app.patch('/api/v1/tasks/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const task = await requireTaskAccess(id, u);
        const body = parseBody(UpdateTaskSchema, req.body);
        const updated = await updateTask(id, body);
        audit({ actor_id: u.sub, event: 'TASK_UPDATED', task_id: id, workspace_id: task.workspace_id });
        if (updated) broadcastTaskEvent(id, { type: 'task:state', payload: { task: updated } });
        return updated;
    });

    app.delete('/api/v1/tasks/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const task = await requireTaskAccess(id, u);
        const roles = u.system_roles as UserRole[];
        if (!(roles.includes('ADMIN') || task.driver_id === u.sub)) throw forbidden();
        await updateTask(id, { status: 'ARCHIVED' });
        audit({ actor_id: u.sub, event: 'TASK_ARCHIVED', task_id: id, workspace_id: task.workspace_id });
        return { ok: true };
    });

    app.post('/api/v1/tasks/:id/handoff', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const body = parseBody(HandOffSchema, req.body);
        const task = await requireTaskAccess(id, u);
        // Only the current driver (or a system admin) can hand the room over.
        const roles = u.system_roles as UserRole[];
        if (task.driver_id !== u.sub && !roles.includes('ADMIN')) {
            throw forbidden('only the current driver can hand off this room');
        }
        if (body.to_user_id === task.driver_id) throw badRequest('that user is already driving');
        const updated = await handOff(id, u.sub, body.to_user_id);
        await addTaskMember({ task_id: id, user_id: body.to_user_id, added_by: u.sub });
        // Notify the new driver so they know the room is now theirs.
        await notify({
            user_id: body.to_user_id,
            workspace_id: task.workspace_id,
            task_id: id,
            kind: 'ROOM_HANDOFF',
            title: `${u.email} handed “${task.title}” to you`,
            body: 'You are now driving this room.',
        });
        audit({
            actor_id: u.sub,
            event: 'TASK_HANDED_OFF',
            task_id: id,
            workspace_id: task.workspace_id,
            target_id: body.to_user_id,
            payload: { note: body.note ?? null },
        });
        if (updated) broadcastTaskEvent(id, { type: 'task:state', payload: { task: updated } });
        return updated;
    });

    // ── Room members (invites) ────────────────────────────────
    // Only the room driver or a workspace ADMIN may manage members.
    // Invitees must already be workspace members ("already added users").
    app.get('/api/v1/tasks/:id/members', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        await requireTaskAccess(id, u);
        return listTaskMembers(id);
    });

    app.post('/api/v1/tasks/:id/members', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const task = await requireTaskAccess(id, u);
        if (!(await canManageMembers(task, u))) {
            throw forbidden('only the room driver or a workspace admin can invite');
        }
        const body = parseBody(z.object({ user_id: z.string().uuid() }), req.body);
        if (!(await isMember(task.workspace_id, body.user_id))) {
            throw badRequest('that user is not a member of this workspace');
        }
        const added = await addTaskMember({ task_id: id, user_id: body.user_id, added_by: u.sub });
        if (added) {
            await notify({
                user_id: body.user_id,
                workspace_id: task.workspace_id,
                task_id: id,
                kind: 'ROOM_INVITE',
                title: `You were added to “${task.title}”`,
                body: `${u.email} invited you to this shared room.`,
            });
            audit({
                actor_id: u.sub,
                event: 'MEMBER_ADDED',
                task_id: id,
                workspace_id: task.workspace_id,
                target_id: body.user_id,
            });
            broadcastTaskEvent(id, {
                type: 'activity',
                payload: { event: 'member_added', actor_id: u.sub, target_id: body.user_id, summary: 'A teammate was added to the room' },
            });
        }
        return { ok: true, added };
    });

    app.delete('/api/v1/tasks/:id/members/:userId', async (req: any) => {
        const { id, userId } = req.params as { id: string; userId: string };
        const u = asUser(req);
        const task = await requireTaskAccess(id, u);
        if (!(await canManageMembers(task, u))) {
            throw forbidden('only the room driver or a workspace admin can remove members');
        }
        if (userId === task.driver_id) throw badRequest('the driver cannot be removed from their own room');
        await removeTaskMember(id, userId);
        audit({
            actor_id: u.sub,
            event: 'MEMBER_REMOVED',
            task_id: id,
            workspace_id: task.workspace_id,
            target_id: userId,
        });
        broadcastTaskEvent(id, {
            type: 'activity',
            payload: { event: 'member_removed', actor_id: u.sub, target_id: userId, summary: 'A member was removed from the room' },
        });
        return { ok: true };
    });

    // ── Evidence ─────────────────────────────────────────────
    app.get('/api/v1/tasks/:id/evidence', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const task = await requireTaskAccess(id, u);
        return listEvidence(id);
    });

    app.post('/api/v1/tasks/:id/evidence', async (req: any, reply: any) => {
        const { id: taskId } = req.params as { id: string };
        const u = asUser(req);
        const task = await requireTaskAccess(taskId, u);
        const body = parseBody(EvidenceUploadSchema, req.body);

        await ensureBucket();
        const ext = body.filename.includes('.') ? body.filename.split('.').pop() : 'bin';
        const storage_key = `${taskId}/${uuid()}.${ext}`;
        const upload_url = await presignedPutUrl(storage_key);

        const evidence = await createEvidenceRecord({
            task_id: taskId,
            uploaded_by: u.sub,
            kind: body.kind,
            filename: body.filename,
            mime_type: body.mime_type,
            byte_size: body.byte_size,
            storage_key,
            checksum_sha256: body.checksum_sha256 ?? null,
            metadata: body.metadata ?? {},
        });

        audit({
            actor_id: u.sub,
            event: 'EVIDENCE_UPLOADED',
            task_id: taskId,
            workspace_id: task.workspace_id,
            target_id: evidence.id,
            payload: { filename: body.filename, byte_size: body.byte_size },
        });
        broadcastTaskEvent(taskId, { type: 'evidence:uploaded', payload: { evidence } });

        return reply.status(201).send({ evidence, upload_url, storage_key });
    });
}

export async function evidenceRoutes(app: any): Promise<void> {
    app.addHook('preHandler', app.authenticate);

    app.get('/api/v1/evidence/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const evidence = await getEvidence(id);
        if (!evidence) throw notFound();
        const task = await requireTaskAccess(evidence.task_id, u);
        return evidence;
    });

    app.get('/api/v1/evidence/:id/download', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const evidence = await getEvidence(id);
        if (!evidence) throw notFound();
        const task = await requireTaskAccess(evidence.task_id, u);
        const url = await presignedGetUrl(evidence.storage_key);
        return { url };
    });

    app.delete('/api/v1/evidence/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const evidence = await getEvidence(id);
        if (!evidence) throw notFound();
        const task = await requireTaskAccess(evidence.task_id, u);
        const roles = u.system_roles as UserRole[];
        if (!(roles.includes('ADMIN') || evidence.uploaded_by === u.sub)) throw forbidden();
        try {
            await deleteObject(evidence.storage_key);
        } catch (e) {
            // best-effort — still remove the metadata
        }
        await deleteEvidence(id);
        audit({ actor_id: u.sub, event: 'EVIDENCE_DELETED', task_id: task.id, workspace_id: task.workspace_id, target_id: id });
        return { ok: true };
    });

    // Internal OCR callback lives in src/internal/routes.ts (shared-secret auth,
    // outside the JWT scope).

    // Called by the browser right after a successful presigned PUT so the
    // OCR + RAG indexing pipeline actually kicks off (multipart path does it
    // inline; this closes the gap for direct-to-MinIO uploads).
    app.post('/api/v1/evidence/:id/complete', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const evidence = await getEvidence(id);
        if (!evidence) throw notFound();
        const task = await requireTaskAccess(evidence.task_id, u);

        aiOcr({
            storage_key: evidence.storage_key,
            filename: evidence.filename,
            mime_type: evidence.mime_type,
        })
            .then(async (res) => {
                await setEvidenceOcrText(id, res.text);
                await indexEvidence({
                    evidence_id: id,
                    storage_key: evidence.storage_key,
                    filename: evidence.filename,
                    mime_type: evidence.mime_type,
                    ocr_text: res.text,
                    kind: evidence.kind,
                });
                broadcastTaskEvent(evidence.task_id, {
                    type: 'activity',
                    payload: { event: 'evidence_indexed', target_id: id, summary: `Indexed ${evidence.filename}` },
                });
            })
            .catch((e) => {
                // eslint-disable-next-line no-console
                console.error('evidence.complete.pipeline failed', e);
            });

        return { ok: true, message: 'OCR + indexing started' };
    });

    // Server-side proxy for evidence uploads when the browser cannot do
    // direct-to-MinIO presigned PUTs (e.g. through the nginx dev proxy).
    app.post('/api/v1/evidence/:id/upload-proxy', async (req: any, reply: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const evidence = await getEvidence(id);
        if (!evidence) throw notFound();
        if (evidence.uploaded_by !== u.sub) throw forbidden();
        const data = await req.file();
        if (!data) throw badRequest('multipart field "file" required');
        const buf = await data.toBuffer();
        await putObject(evidence.storage_key, buf, data.mimetype);

        // Kick off OCR + indexing.
        aiOcr({
            storage_key: evidence.storage_key,
            filename: evidence.filename,
            mime_type: evidence.mime_type,
        })
            .then(async (res) => {
                await setEvidenceOcrText(id, res.text);
                await indexEvidence({
                    evidence_id: id,
                    storage_key: evidence.storage_key,
                    filename: evidence.filename,
                    mime_type: evidence.mime_type,
                    ocr_text: res.text,
                    kind: evidence.kind,
                });
            })
            .catch(() => undefined);

        return reply.send({ ok: true });
    });
}
