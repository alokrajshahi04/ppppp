export * from './common.js';

export type UserRole =
    | 'ADMIN'
    | 'DRIVER'
    | 'REVIEWER'
    | 'WATCHER'
    | 'SECURITY_APPROVER';

export type TaskStatus =
    | 'DRAFT'
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'AWAITING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'COMPLETED'
    | 'ARCHIVED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EvidenceKind = 'PDF' | 'IMAGE' | 'DIAGRAM' | 'TEXT' | 'CODE' | 'OTHER';

export type AIRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export type ApprovalState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export type ApprovalKind = 'OUTPUT' | 'ACTION' | 'REPORT' | 'SENSITIVE_FINDING';

export type ModelCapability = 'OCR' | 'VISION' | 'TEXT' | 'CODE' | 'EMBEDDING';

export type MessageKind = 'USER' | 'AI' | 'SYSTEM' | 'COMMENT';

export type PresenceStatus = 'ONLINE' | 'IDLE' | 'OFFLINE';

export type AuditEventKind =
    | 'USER_LOGIN'
    | 'USER_LOGOUT'
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'USER_DELETED'
    | 'ROLE_CHANGED'
    | 'WORKSPACE_CREATED'
    | 'WORKSPACE_UPDATED'
    | 'MEMBER_ADDED'
    | 'MEMBER_REMOVED'
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'TASK_HANDED_OFF'
    | 'TASK_ARCHIVED'
    | 'EVIDENCE_UPLOADED'
    | 'EVIDENCE_DELETED'
    | 'AI_RUN_STARTED'
    | 'AI_RUN_COMPLETED'
    | 'AI_RUN_FAILED'
    | 'AI_OUTPUT_GENERATED'
    | 'APPROVAL_REQUESTED'
    | 'APPROVAL_GRANTED'
    | 'APPROVAL_REJECTED'
    | 'REPORT_GENERATED'
    | 'POLICY_CHANGED'
    | 'MODEL_CONFIG_CHANGED'
    | 'STORAGE_CONFIG_CHANGED';
