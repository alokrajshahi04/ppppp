import type { UUID } from './common.js';
import type { Message } from './messages.js';
import type { PresenceEntry } from './rooms.js';
import type { Task, Evidence } from './tasks.js';
import type { AIRun } from './ai.js';
import type { Approval } from './governance.js';

// ─────────────────────────────────────────────────────────────
//  WebSocket protocol — multiplayer collaboration rooms
// ─────────────────────────────────────────────────────────────

export interface WSEnvelope<T = unknown> {
    type: string;
    payload: T;
    ts: string;
    sender_id?: UUID;
}

export interface WSClientHello {
    task_id: UUID;
    auth_token: string;
}

export interface WSServerHello {
    user_id: UUID;
    task: Task;
    initial_messages: Message[];
    initial_presence: PresenceEntry[];
    initial_evidence: Evidence[];
}

export interface WSPresenceUpdate {
    user_id: UUID;
    status: 'ONLINE' | 'IDLE' | 'OFFLINE';
    cursor?: {
        x: number;
        y: number;
        target?: string;
    };
}

export interface WSMessagePosted {
    message: Message;
}

export interface WSEvidenceUploaded {
    evidence: Evidence;
}

export interface WSAIRunStarted {
    run: AIRun;
}

export interface WSAIRunProgress {
    run_id: UUID;
    token?: string;
    status: AIRun['status'];
    partial_response?: string;
}

export interface WSAIRunCompleted {
    run: AIRun;
}

export interface WSApprovalRequested {
    approval: Approval;
}

export interface WSApprovalDecided {
    approval: Approval;
}

export interface WSActivity {
    event: string;
    actor_id: UUID;
    target_type?: string;
    target_id?: string;
    summary: string;
    payload?: Record<string, unknown>;
}

export interface WSCommentAdded {
    message: Message;
}

export interface WSTyping {
    user_id: UUID;
    is_typing: boolean;
}

export interface WSTaskStateChanged {
    task: Task;
}

export interface WSError {
    code: string;
    message: string;
}

export type WSClientMessage =
    | { type: 'hello'; payload: WSClientHello }
    | { type: 'presence:update'; payload: WSPresenceUpdate }
    | { type: 'message:post'; payload: { task_id: UUID; content: string; reply_to?: UUID } }
    | { type: 'cursor:move'; payload: { x: number; y: number; target?: string } }
    | { type: 'typing'; payload: WSTyping }
    | { type: 'ping'; payload: { ts: number } };

export type WSServerMessage =
    | { type: 'hello:ok'; payload: WSServerHello }
    | { type: 'presence:update'; payload: WSPresenceUpdate }
    | { type: 'message:posted'; payload: WSMessagePosted }
    | { type: 'evidence:uploaded'; payload: WSEvidenceUploaded }
    | { type: 'ai:started'; payload: WSAIRunStarted }
    | { type: 'ai:progress'; payload: WSAIRunProgress }
    | { type: 'ai:completed'; payload: WSAIRunCompleted }
    | { type: 'approval:requested'; payload: WSApprovalRequested }
    | { type: 'approval:decided'; payload: WSApprovalDecided }
    | { type: 'activity'; payload: WSActivity }
    | { type: 'comment:added'; payload: WSCommentAdded }
    | { type: 'typing'; payload: WSTyping }
    | { type: 'task:state'; payload: WSTaskStateChanged }
    | { type: 'error'; payload: WSError }
    | { type: 'pong'; payload: { ts: number; server_ts: number } };
