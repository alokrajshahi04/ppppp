import type { Message, MessageKind } from '@tolti/contracts';
import { query } from '../db/pool.js';

export async function listMessages(taskId: string, limit = 200, before?: string): Promise<Message[]> {
    const params: unknown[] = [taskId];
    let where = 'WHERE task_id = $1';
    if (before) {
        params.push(before);
        where += ` AND created_at < $${params.length}`;
    }
    const { rows } = await query<Message & { sender_email: string; sender_name: string }>(
        `SELECT m.*, u.email AS sender_email, u.display_name AS sender_name
           FROM messages m LEFT JOIN users u ON u.id = m.sender_id
           ${where}
          ORDER BY m.created_at DESC LIMIT ${limit}`,
        params,
    );
    return rows.reverse().map((r) => ({
        ...r,
        sender: r.sender_id ? { id: r.sender_id, display_name: r.sender_name } : undefined,
    })) as unknown as Message[];
}

export async function createMessage(input: {
    task_id: string;
    sender_id: string | null;
    kind: MessageKind;
    content: string;
    attachments?: unknown[];
    metadata?: Record<string, unknown>;
}): Promise<Message> {
    const { rows } = await query<Message>(
        `INSERT INTO messages (task_id, sender_id, kind, content, attachments, metadata)
         VALUES ($1, $2, $3::message_kind, $4, $5::jsonb, $6::jsonb) RETURNING *`,
        [
            input.task_id,
            input.sender_id,
            input.kind,
            input.content,
            JSON.stringify(input.attachments ?? []),
            JSON.stringify(input.metadata ?? {}),
        ],
    );
    return rows[0]!;
}
