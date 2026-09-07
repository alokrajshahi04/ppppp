import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Workspace, TaskStatus, TaskPriority } from '@tolti/contracts';
import { api } from '../api/client';

export function TaskListPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [wsFilter, setWsFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const ws = await api.get<Workspace[]>('/api/v1/workspaces');
            setWorkspaces(ws);
            if (ws[0]) setWsFilter(ws[0].id);
        })();
    }, []);

    useEffect(() => {
        if (!wsFilter) return;
        (async () => {
            setLoading(true);
            try {
                const r = await api.get<{ items: Task[] }>(`/api/v1/tasks?workspace_id=${wsFilter}${statusFilter ? `&status=${statusFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
                setTasks(r.items);
            } finally {
                setLoading(false);
            }
        })();
    }, [wsFilter, statusFilter, q]);

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">Tasks</div>
                    <div className="page-sub">All collaborative AI investigations across your workspaces.</div>
                </div>
            </div>
            <div className="card">
                <div className="row" style={{ marginBottom: 'var(--s-4)' }}>
                    <select className="select" value={wsFilter} onChange={(e) => setWsFilter(e.target.value)}>
                        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}>
                        <option value="">All statuses</option>
                        {['DRAFT', 'OPEN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'ARCHIVED'].map((s) => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                    </select>
                    <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {loading ? (
                    <div className="empty"><span className="spinner" /></div>
                ) : tasks.length === 0 ? (
                    <div className="empty">No tasks match these filters.</div>
                ) : (
                    <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Driver</th>
                                <th>Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map((t) => (
                                <tr key={t.id}>
                                    <td><a href={`/tasks/${t.id}`}>{t.title}</a></td>
                                    <td><span className={`pill pill-${statusTone(t.status)}`}>{t.status.replace('_', ' ')}</span></td>
                                    <td>{t.priority}</td>
                                    <td className="muted mono">{t.driver_id.slice(0, 8)}</td>
                                    <td className="muted mono">{new Date(t.updated_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export function NewTaskPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [workspaceId, setWorkspaceId] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            const ws = await api.get<Workspace[]>('/api/v1/workspaces');
            setWorkspaces(ws);
            if (ws[0]) setWorkspaceId(ws[0].id);
        })();
    }, []);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
            const created = await api.post<Task>('/api/v1/tasks', {
                workspace_id: workspaceId,
                title,
                description,
                priority,
            });
            navigate(`/tasks/${created.id}`);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'create failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">New task</div>
                    <div className="page-sub">Start a new collaborative AI investigation.</div>
                </div>
            </div>
            <form className="card" style={{ maxWidth: 640 }} onSubmit={onSubmit}>
                {err && <div className="banner banner-error">{err}</div>}
                <div className="field">
                    <label className="field-label">Workspace</label>
                    <select className="select" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} required>
                        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="field">
                    <label className="field-label">Title</label>
                    <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="field">
                    <label className="field-label">Description</label>
                    <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
                </div>
                <div className="field">
                    <label className="field-label">Priority</label>
                    <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TaskPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : 'Create task'}</button>
            </form>
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
