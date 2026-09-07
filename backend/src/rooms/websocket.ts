import type { FastifyRequest } from 'fastify';
import { listEvidence } from '../tasks/repo.js';
import { requireTaskAccess } from '../tasks/access.js';
import { listMessages } from '../messages/repo.js';
import { findUserById } from '../users/repo.js';
import { getTaskPresence, setPresence } from './presence.js';
import { registerRoomListener } from './broadcaster.js';
import { audit } from '../governance/audit.js';

interface SocketConnection {
    socket: any; // raw ws
    send: (env: any) => void;
}

interface RoomSession {
    taskId: string;
    userId: string;
    unsubscribe: () => void;
}

const sessions = new WeakMap<object, RoomSession>();

export async function websocketRoutes(app: any): Promise<void> {
    app.get('/ws/tasks/:id', { websocket: true }, async (socket: any, req: any) => {
        const { id: taskId } = req.params as { id: string };
        const token = (req.query as Record<string, string>).token;
        if (!token) {
            socket.send(JSON.stringify({ type: 'error', payload: { code: 'UNAUTHORIZED', message: 'missing token' } }));
            return socket.close();
        }
        let payload: { sub: string; email: string; system_roles: string[] };
        try {
            payload = await app.jwt.verify(token);
        } catch {
            socket.send(JSON.stringify({ type: 'error', payload: { code: 'UNAUTHORIZED', message: 'invalid token' } }));
            return socket.close();
        }

        let task;
        try {
            task = await requireTaskAccess(taskId, { sub: payload.sub, system_roles: payload.system_roles });
        } catch {
            task = null;
        }
        if (!task) {
            socket.send(JSON.stringify({ type: 'error', payload: { code: 'NOT_FOUND', message: 'task not found' } }));
            return socket.close();
        }
        const user = await findUserById(payload.sub);
        if (!user) {
            socket.close();
            return;
        }

        const send = (env: any) => socket.send(JSON.stringify(env));

        const initial_messages = await listMessages(taskId);
        const initial_evidence = await listEvidence(taskId);
        const initial_presence = await getTaskPresence(taskId);

        send({
            type: 'hello:ok',
            ts: new Date().toISOString(),
            payload: {
                user_id: user.id,
                task,
                initial_messages,
                initial_presence,
                initial_evidence,
            },
        });

        await setPresence(taskId, user.id, 'ONLINE');

        const unsubscribe = registerRoomListener(taskId, (env) => send(env));

        sessions.set(socket as unknown as object, { taskId, userId: user.id, unsubscribe });

        socket.on('message', async (raw: Buffer) => {
            let msg: any;
            try {
                msg = JSON.parse(raw.toString());
            } catch {
                return;
            }
            await handleClientMessage(socket, req, msg, user.id, taskId);
        });

        socket.on('close', async () => {
            unsubscribe();
            await setPresence(taskId, user.id, 'OFFLINE');
            sessions.delete(socket as unknown as object);
            audit({
                actor_id: user.id,
                event: 'USER_LOGOUT',
                task_id: taskId,
                payload: { reason: 'ws close' },
            });
        });
    });
}

async function handleClientMessage(
    socket: any,
    req: any,
    msg: any,
    userId: string,
    taskId: string,
): Promise<void> {
    switch (msg.type) {
        case 'ping':
            socket.send(JSON.stringify({ type: 'pong', payload: { ts: msg.payload?.ts ?? Date.now(), server_ts: Date.now() } }));
            break;
        case 'presence:update':
            await setPresence(taskId, userId, msg.payload?.status ?? 'ONLINE');
            break;
        case 'typing':
            // echo to others in the room — kept simple, could be throttled
            socket.send(JSON.stringify({ type: 'noop' })); // placeholder
            break;
        case 'cursor:move':
            // store under presence.cursor if needed
            break;
        case 'message:post': {
            const { createMessage } = await import('../messages/repo.js');
            const created = await createMessage({
                task_id: taskId,
                sender_id: userId,
                kind: 'USER',
                content: msg.payload.content,
            });
            const { broadcastTaskEvent } = await import('./broadcaster.js');
            broadcastTaskEvent(taskId, { type: 'message:posted', payload: { message: created } });
            break;
        }
        default:
            // ignore unknown
            break;
    }
}
