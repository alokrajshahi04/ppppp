import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task, Workspace, Notification } from '@tolti/contracts';
import { api } from '../api/client';
import { useAuth } from '../store/auth';

export function DashboardPage() {
    const { user } = useAuth();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const ws = await api.get<Workspace[]>('/api/v1/workspaces');
                setWorkspaces(ws);
                if (ws[0]) {
                    const r = await api.get<{ items: Task[]; total: number }>(`/api/v1/tasks?workspace_id=${ws[0].id}&page_size=8`);
                    setTasks(r.items);
                }
                const n = await api.get<Notification[]>('/api/v1/notifications');
                setNotifications(n.slice(0, 5));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return <div className="page"><div className="empty"><span className="spinner" /> Loading…</div></div>;

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">Welcome back, {user?.display_name?.split(' ')[0] ?? 'there'}.</div>
                    <div className="page-sub">{workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}. Sovereign, on-prem, air-gapped.</div>
                </div>
                <Link to="/tasks/new" className="btn btn-primary">New task</Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--s-5)' }}>
                <div className="card">
                    <div className="row-between">
                        <div className="card-title">Recent tasks</div>
                        <Link to="/tasks" className="muted" style={{ fontSize: 'var(--fz-small)' }}>See all →</Link>
                    </div>
                    {tasks.length === 0 ? (
                        <div className="empty">No tasks yet. <Link to="/tasks/new" className="muted">Create one.</Link></div>
                    ) : (
                        <div className="table-wrap">
                    <table className="table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Status</th>
                                    <th>Priority</th>
                                    <th>Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((t) => (
                                    <tr key={t.id}>
                                        <td><Link to={`/tasks/${t.id}`}>{t.title}</Link></td>
                                        <td><span className={`pill pill-${statusTone(t.status)}`}>{t.status.replace('_', ' ')}</span></td>
                                        <td><span className="muted">{t.priority}</span></td>
                                        <td className="muted mono">{new Date(t.updated_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
                <div className="card">
                    <div className="card-title">Notifications</div>
                    {notifications.length === 0 ? (
                        <div className="muted">All caught up.</div>
                    ) : (
                        <div className="stack">
                            {notifications.map((n) => (
                                <div key={n.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 'var(--s-2)' }}>
                                    <div style={{ fontWeight: 500 }}>{n.title}</div>
                                    {n.body && <div className="muted" style={{ fontSize: 'var(--fz-small)' }}>{n.body}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function statusTone(status: string): string {
    if (status === 'COMPLETED' || status === 'APPROVED') return 'success';
    if (status === 'REJECTED' || status === 'ARCHIVED') return 'danger';
    if (status === 'AWAITING_APPROVAL') return 'pending';
    if (status === 'IN_PROGRESS') return 'info';
    return 'info';
}
