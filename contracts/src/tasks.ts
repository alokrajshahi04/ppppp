import type {
    TaskStatus,
    TaskPriority,
    EvidenceKind,
    AuditInfo,
    UUID,
} from './common.js';

export interface Task extends AuditInfo {
    id: UUID;
    workspace_id: UUID;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    driver_id: UUID;
    handed_off_to: UUID | null;
    parent_task_id: UUID | null;
    completed_at: string | null;
    evidence_count?: number;
    message_count?: number;
}

export interface CreateTaskRequest {
    workspace_id: UUID;
    title: string;
    description?: string;
    priority?: TaskPriority;
}

export interface UpdateTaskRequest {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
}

export interface HandOffRequest {
    to_user_id: UUID;
    note?: string;
}

export interface TaskFilters {
    workspace_id?: UUID;
    status?: TaskStatus;
    priority?: TaskPriority;
    driver_id?: UUID;
    q?: string;
    page?: number;
    page_size?: number;
}

export interface Evidence {
    id: UUID;
    task_id: UUID;
    uploaded_by: UUID;
    kind: EvidenceKind;
    filename: string;
    mime_type: string;
    byte_size: number;
    storage_key: string;
    checksum_sha256: string | null;
    metadata: Record<string, unknown>;
    ocr_text: string | null;
    ocr_completed: boolean;
    uploaded_at: string;
    uploader?: {
        id: UUID;
        display_name: string;
    };
}

export interface EvidenceUploadRequest {
    task_id: UUID;
    kind: EvidenceKind;
    metadata?: Record<string, unknown>;
}

export interface EvidenceUploadResponse {
    evidence: Evidence;
    upload_url: string;
    storage_key: string;
}
