// Tolti AI · shared message types
import type { UUID, MessageKind, ISO8601 } from './common.js';

export interface Message {
    id: UUID;
    task_id: UUID;
    sender_id: UUID | null;
    kind: MessageKind;
    content: string;
    attachments: unknown[];
    metadata: Record<string, unknown>;
    created_at: ISO8601;
    sender?: {
        id: UUID;
        display_name: string;
    };
}
