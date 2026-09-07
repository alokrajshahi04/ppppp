import { useEffect, useState, type FormEvent } from 'react';
import type { Workspace, User, UserRole } from '@tolti/contracts';
import { api } from '../api/client';

export function WorkspacesPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [members, setMembers] = useState<Array<{ user_id: string; role: UserRole; user?: { email: string; display_name: string } }>>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');

    async function refresh() {
        const ws = await api.get<Workspace[]>('/api/v1/workspaces');
        setWorkspaces(ws);
        if (ws[0]) setSelected(ws[0].id);
    }
    useEffect(() => { void refresh(); api.get<User[]>('/api/v1/users').then(setUsers).catch(() => undefined); }, []);

    useEffect(() => {
        if (!selected) return;
        api.get<typeof members>(`/api/v1/workspaces/${selected}/members`).then(setMembers);
    }, [selected]);

    async function create(e: FormEvent) {
        e.preventDefault();
        await api.post('/api/v1/workspaces', { name, slug, description });
        setName(''); setSlug(''); setDescription('');
        await refresh();
    }

    async function add(userId: string) {
        if (!selected) return;
        await api.post(`/api/v1/workspaces/${selected}/members`, { user_id: userId, role: 'REVIEWER' });
        const m = await api.get<typeof members>(`/api/v1/workspaces/${selected}/members`);
        setMembers(m);
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">Workspaces</div>
                    <div className="page-sub">Isolated collaboration rooms. Each workspace keeps its own tasks, evidence and members.</div>
                </div>
            </div>

            <form className="card" style={{ marginBottom: 'var(--s-4)' }} onSubmit={create}>
                <div className="card-title">Create workspace</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 'var(--s-3)', alignItems: 'end' }}>
                    <div className="field"><label className="field-label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
                    <div className="field"><label className="field-label">Slug</label><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" /></div>
                    <div className="field"><label className="field-label">Description</label><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                    <button className="btn btn-primary" type="submit">Create</button>
                </div>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--s-5)' }}>
                <div className="card">
                    <div className="card-title">All workspaces</div>
                    <div className="stack">
                        {workspaces.map((w) => (
                            <button
                                key={w.id}
                                onClick={() => setSelected(w.id)}
                                className="btn btn-ghost"
                                style={{ justifyContent: 'flex-start', borderColor: selected === w.id ? 'var(--accent)' : 'transparent' }}
                            >
                                {w.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="card">
                    <div className="card-title">Members</div>
                    {members.length === 0 ? <div className="muted">No members.</div> : (
                        <div className="table-wrap">
                    <table className="table">
                            <thead>
                                <tr><th>User</th><th>Email</th><th>Role</th></tr>
                            </thead>
                            <tbody>
                                {members.map((m) => (
                                    <tr key={m.user_id}>
                                        <td>{m.user?.display_name ?? '—'}</td>
                                        <td className="mono muted">{m.user?.email ?? '—'}</td>
                                        <td><span className="pill pill-accent">{m.role}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}
                    <div className="divider" />
                    <div className="field">
                        <label className="field-label">Add member</label>
                        <div className="row">
                            <select className="select" id="add-user">
                                {users.filter((u) => !members.some((m) => m.user_id === u.id)).map((u) => (
                                    <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>
                                ))}
                            </select>
                            <button className="btn" onClick={() => {
                                const sel = (document.getElementById('add-user') as HTMLSelectElement);
                                if (sel?.value) add(sel.value);
                            }}>Add as Reviewer</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
