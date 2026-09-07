import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Task, TaskStatus, Workspace } from '@tolti/contracts';
import { api } from '../api/client';
import { initialsOf, loadWorkspaces } from '../store/auth';
import { NewChatModal } from '../components/NewChatModal';
import { IconChat, IconLock, IconPlus, IconSearch } from '../ui/icons';

const STATUSES: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'APPROVED', 'COMPLETED', 'ARCHIVED'];

export function RoomsPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [rooms, setRooms] = useState<Task[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [status, setStatus] = useState<TaskStatus | ''>('');
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);
    const [newChat, setNewChat] = useState<null | 'SHARED' | 'PRIVATE'>(params.get('new') === '1' ? 'SHARED' : null);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const ws = await loadWorkspaces();
            setWorkspaces(ws);
            const qs = new URLSearchParams({ page_size: '50' });
            // Keep the list consistent with the rail — scoped to the active workspace.
            const active = localStorage.getItem('tolti.ws');
            if (active) qs.set('workspace_id', active);
            if (status) qs.set('status', status);
            if (q) qs.set('q', q);
            const r = await api.get<{ items: Task[] }>(`/api/v1/tasks?${qs}`);
            setRooms(r.items);
        } finally {
            setLoading(false);
        }
    }, [status, q]);

    useEffect(() => {
        const t = window.setTimeout(() => void reload(), q ? 250 : 0);
        return () => window.clearTimeout(t);
    }, [reload, q]);

    useEffect(() => {
        const wsChanged: EventListener = () => void reload();
        window.addEventListener('tolti:ws-changed', wsChanged);
        return () => window.removeEventListener('tolti:ws-changed', wsChanged);
    }, [reload]);

    useEffect(() => {
        if (params.get('new') === '1') {
            const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate('/rooms'); };
            window.addEventListener('keydown', onKey);
            return () => window.removeEventListener('keydown', onKey);
        }
    }, [params, navigate]);

    return (
        <div className="page page-wide">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Rooms</h1>
                    <div className="page-sub">Every shared room and private chat you can access, newest activity first.</div>
                </div>
                <div className="row">
                    <button className="btn btn-accent" onClick={() => setNewChat('SHARED')}><IconPlus size={13} /> New chat</button>
                </div>
            </div>

            <div className="card">
                <div className="row" style={{ marginBottom: 'var(--s-4)', flexWrap: 'wrap' }}>
                    <div className="row" style={{ flex: 1, minWidth: 220, border: '1px solid var(--line-strong)', borderRadius: 'var(--r-2)', padding: '0 10px', background: 'var(--bg-inset)' }}>
                        <IconSearch />
                        <input
                            className="input"
                            style={{ border: 0, background: 'transparent', padding: '8px 0' }}
                            placeholder="Search rooms…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    <select className="select" style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | '')}>
                        <option value="">All statuses</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                </div>

                {loading ? (
                    <div className="empty"><span className="spinner" /></div>
                ) : rooms.length === 0 ? (
                    <div className="empty">
                        No rooms yet. Start a shared chat with your team, or a private chat for yourself.
                        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
                            <button className="btn btn-accent" onClick={() => setNewChat('SHARED')}><IconPlus size={13} /> New chat</button>
                        </div>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr><th>Room</th><th>Kind</th><th>Status</th><th>Priority</th><th>Messages</th><th>Updated</th></tr>
                            </thead>
                            <tbody>
                                {rooms.map((r) => (
                                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/rooms/${r.id}`)}>
                                        <td>
                                            <span className="row" style={{ gap: 10 }}>
                                                <span className="avatar" style={{ width: 26, height: 26, fontSize: 9 }}>{initialsOf(r.title)}</span>
                                                <span className="ellipsis" style={{ maxWidth: 320, color: 'var(--ink-1)' }}>{r.title}</span>
                                            </span>
                                        </td>
                                        <td>{r.kind === 'PRIVATE' ? <span className="pill pill-accent">private</span> : <span className="pill pill-muted">shared</span>}</td>
                                        <td><span className={`pill ${r.status === 'COMPLETED' || r.status === 'APPROVED' ? 'pill-live' : r.status === 'REJECTED' || r.status === 'ARCHIVED' ? 'pill-danger' : 'pill-warn'}`}>{r.status.replace('_', ' ').toLowerCase()}</span></td>
                                        <td className="muted">{r.priority.toLowerCase()}</td>
                                        <td className="muted mono">{r.message_count ?? 0}</td>
                                        <td className="muted mono nowrap">{new Date(r.updated_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {newChat && (
                <NewChatModal
                    mode={newChat}
                    workspaces={workspaces}
                    onClose={() => { setNewChat(null); if (params.get('new')) navigate('/rooms'); }}
                    onCreated={(id) => { setNewChat(null); window.dispatchEvent(new CustomEvent('tolti:rooms-changed')); navigate(`/rooms/${id}`); }}
                />
            )}
        </div>
    );
}
