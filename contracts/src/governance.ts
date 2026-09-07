import type { ApprovalKind, ApprovalState, AuditInfo, UUID } from './common.js';

export interface Approval extends AuditInfo {
    id: UUID;
    task_id: UUID;
    requested_by: UUID;
    decided_by: UUID | null;
    kind: ApprovalKind;
    target_id: UUID | null;
    summary: string;
    reason: string | null;
    state: ApprovalState;
    requested_at: string;
    decided_at: string | null;
    requester?: {
        id: UUID;
        display_name: string;
    };
    decider?: {
        id: UUID;
        display_name: string;
    } | null;
}

export interface CreateApprovalRequest {
    task_id: UUID;
    kind: ApprovalKind;
    target_id?: UUID;
    summary: string;
    reason?: string;
}

export interface DecideApprovalRequest {
    decision: 'APPROVED' | 'REJECTED';
    reason?: string;
}

export interface AuditLogEntry {
    id: string;
    actor_id: UUID | null;
    workspace_id: UUID | null;
    task_id: UUID | null;
    event: string;
    target_type: string | null;
    target_id: string | null;
    payload: Record<string, unknown>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    actor?: {
        id: UUID;
        display_name: string;
        email: string;
    } | null;
}

export interface AuditFilters {
    workspace_id?: UUID;
    task_id?: UUID;
    actor_id?: UUID;
    event?: string;
    from?: string;
    to?: string;
    page?: number;
    page_size?: number;
}

export interface Notification {
    id: UUID;
    user_id: UUID;
    workspace_id: UUID | null;
    task_id: UUID | null;
    kind: string;
    title: string;
    body: string | null;
    read_at: string | null;
    created_at: string;
}
