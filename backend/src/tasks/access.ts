// Single source of truth for room-level access.
// Workspace membership is the outer boundary; room membership refines it.
import type { Task } from '@tolti/contracts';
import { getTask, isTaskMember } from './repo.js';
import { isMember } from '../workspaces/repo.js';
import { notFound } from '../utils/errors.js';

interface Caller {
    sub: string;
    system_roles: string[];
}

/**
 * Load a task enforcing visibility rules; 404 (not 403) so room existence
 * is not disclosed to non-members.
 *  - system ADMIN: full access (audit mandate)
 *  - PRIVATE: driver only
 *  - SHARED: workspace member who is the driver or an invited member
 */
export async function requireTaskAccess(taskId: string, user: Caller): Promise<Task> {
    const task = await getTask(taskId);
    if (!task) throw notFound('task not found');
    if (user.system_roles.includes('ADMIN')) return task;
    if (!(await isMember(task.workspace_id, user.sub))) throw notFound();
    if (task.kind === 'PRIVATE' && task.driver_id !== user.sub) throw notFound();
    if (task.kind === 'SHARED' && task.driver_id !== user.sub && !(await isTaskMember(taskId, user.sub))) {
        throw notFound();
    }
    return task;
}
