import type { UserRole } from '@tolti/contracts';
import { forbidden } from '../utils/errors.js';

/**
 * Coarse RBAC matrix used by every route. The fine-grained "is X allowed in workspace Y?"
 * checks live in repos/services — this is the first gate only.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
    ADMIN: new Set([
        '*',
    ]),
    DRIVER: new Set([
        'workspace.read',
        'workspace.member.read',
        'task.read',
        'task.create',
        'task.update',
        'task.handoff',
        'task.archive',
        'evidence.read',
        'evidence.upload',
        'evidence.delete',
        'message.read',
        'message.post',
        'ai.run.start',
        'ai.run.cancel',
        'approval.request',
        'approval.read',
        'notification.read',
    ]),
    REVIEWER: new Set([
        'workspace.read',
        'workspace.member.read',
        'task.read',
        'task.update',
        'task.handoff',
        'evidence.read',
        'message.read',
        'message.post',
        'ai.run.start',
        'approval.request',
        'approval.read',
        'approval.decide',
        'notification.read',
    ]),
    WATCHER: new Set([
        'workspace.read',
        'workspace.member.read',
        'task.read',
        'evidence.read',
        'message.read',
        'ai.run.read',
        'approval.read',
        'notification.read',
    ]),
    SECURITY_APPROVER: new Set([
        'workspace.read',
        'workspace.member.read',
        'task.read',
        'evidence.read',
        'message.read',
        'ai.run.read',
        'approval.read',
        'approval.decide',
        'audit.read',
        'notification.read',
    ]),
};

export function hasPermission(roles: UserRole[], permission: string): boolean {
    for (const role of roles) {
        const perms = ROLE_PERMISSIONS[role];
        if (perms.has('*') || perms.has(permission)) return true;
    }
    return false;
}

export function requirePermission(roles: UserRole[], permission: string): void {
    if (!hasPermission(roles, permission)) {
        throw forbidden(`missing permission: ${permission}`);
    }
}
