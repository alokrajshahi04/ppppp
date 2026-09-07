import type { UserRole, AuditInfo, UUID } from './common.js';

export interface Workspace extends AuditInfo {
    id: UUID;
    name: string;
    slug: string;
    description: string | null;
    created_by: UUID;
    member_count?: number;
}

export interface WorkspaceMember {
    workspace_id: UUID;
    user_id: UUID;
    role: UserRole;
    joined_at: string;
    user?: {
        id: UUID;
        email: string;
        display_name: string;
    };
}

export interface CreateWorkspaceRequest {
    name: string;
    slug: string;
    description?: string;
}

export interface UpdateWorkspaceRequest {
    name?: string;
    description?: string;
}

export interface AddMemberRequest {
    user_id: UUID;
    role: UserRole;
}

export interface UpdateMemberRequest {
    role: UserRole;
}
