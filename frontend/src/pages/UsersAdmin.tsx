import { useEffect, useState, type FormEvent } from 'react';
import type { User, UserRole } from '@tolti/contracts';
import { api } from '../api/client';

export function UsersAdminPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [roles, setRoles] = useState<UserRole[]>(['DRIVER']);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function refresh() {
        setLoading(true);
        try { setUsers(await api.get<User[]>('/api/v1/users')); } finally { setLoading(false); }
    }
    useEffect(() => { void refresh(); }, []);

    async function onCreate(e: FormEvent) {
        e.preventDefault();
        setBusy(true); setErr(null);
        try {
            await api.post<User>('/api/v1/users', {
                email, display_name: name, password, system_roles: roles,
            });
            setOpen(false); setEmail(''); setName(''); setPassword(''); setRoles(['DRIVER']);
            await refresh();
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'create failed');
        } finally {
            setBusy(false);
        }
    }

    async function deactivate(id: string) {
        if (!confirm('Deactivate this user?')) return;
        await api.del(`/api/v1/users/${id}`);
        await refresh();
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">Users</div>
                    <div className="page-sub">Manage system access and roles.</div>
                </div>
                <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'New user'}</button>
            </div>

            {open && (
                <form className="card" style={{ marginBottom: 'var(--s-4)' }} onSubmit={onCreate}>
                    {err && <div className="banner banner-error">{err}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s-3)' }}>
                        <div className="field">
                            <label className="field-label">Email</label>
                            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <div className="field">
                            <label className="field-label">Display name</label>
                            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="field">
                            <label className="field-label">Password</label>
                            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                        </div>
                    </div>
                    <div className="field">
                        <label className="field-label">Roles</label>
                        <div className="row">
                            {(['ADMIN', 'DRIVER', 'REVIEWER', 'WATCHER', 'SECURITY_APPROVER'] as UserRole[]).map((r) => (
                                <label key={r} className="row" style={{ gap: 6 }}>
                                    <input type="checkbox" checked={roles.includes(r)} onChange={(e) => {
                                        setRoles((cur) => e.target.checked ? [...cur, r] : cur.filter((x) => x !== r));
                                    }} />
                                    <span className="muted">{r}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : 'Create'}</button>
                </form>
            )}

            <div className="card">
                {loading ? (
                    <div className="empty"><span className="spinner" /></div>
                ) : (
                    <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Roles</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.display_name}</td>
                                    <td className="mono muted">{u.email}</td>
                                    <td>{u.system_roles.map((r) => <span key={r} className="pill" style={{ marginRight: 4 }}>{r}</span>)}</td>
                                    <td>{u.is_active ? <span className="pill pill-success">active</span> : <span className="pill pill-danger">disabled</span>}</td>
                                    <td><button className="btn btn-sm btn-ghost" onClick={() => deactivate(u.id)}>Disable</button></td>
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
