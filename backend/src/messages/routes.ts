import { z } from 'zod';
import { createMessage, listMessages } from './repo.js';
import { asUser, forbidden, notFound } from '../utils/errors.js';
import { parseBody } from '../utils/validation.js';
import { getTask } from '../tasks/repo.js';
import { isMember } from '../workspaces/repo.js';
import { broadcastTaskEvent } from '../rooms/broadcaster.js';

const PostSchema = z.object({
    content: z.string().min(1),
    kind: z.enum(['USER', 'AI', 'SYSTEM', 'COMMENT']).optional(),
    attachments: z.array(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
});

const ListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    before: z.string().optional(),
});

export async function messageRoutes(app: any): Promise<void> {
    app.addHook('preHandler', app.authenticate);

    app.get('/api/v1/tasks/:id/messages', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const task = await getTask(id);
        if (!task) throw notFound();
        if (!(await isMember(task.workspace_id, u.sub))) throw forbidden();
        const q = parseBody(ListQuerySchema, req.query ?? {}) as z.infer<typeof ListQuerySchema>;
        return listMessages(id, q.limit ?? 200, q.before);
    });

    app.post('/api/v1/tasks/:id/messages', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const task = await getTask(id);
        if (!task) throw notFound();
        if (!(await isMember(task.workspace_id, u.sub))) throw forbidden();
        const body = parseBody(PostSchema, req.body);
        const msg = await createMessage({
            task_id: id,
            sender_id: u.sub,
            kind: body.kind ?? 'USER',
            content: body.content,
            attachments: body.attachments,
            metadata: body.metadata,
        });
        broadcastTaskEvent(id, { type: 'message:posted', payload: { message: msg } });
        return msg;
    });
}
