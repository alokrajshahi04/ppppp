import type { UserRole, AuditInfo, UUID } from './common.js';

export interface User extends AuditInfo {
    id: UUID;
    email: string;
    display_name: string;
    is_active: boolean;
    system_roles: UserRole[];
}

export interface AuthSession {
    user: User;
    access_token: string;
    refresh_token: string;
    expires_at: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RefreshRequest {
    refresh_token: string;
}

export interface CreateUserRequest {
    email: string;
    display_name: string;
    password: string;
    system_roles: UserRole[];
}

export interface UpdateUserRequest {
    display_name?: string;
    is_active?: boolean;
    system_roles?: UserRole[];
}

export interface ChangePasswordRequest {
    current_password: string;
    new_password: string;
}
