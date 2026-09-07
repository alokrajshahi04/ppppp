import { useEffect, useState } from 'react';
import type { AuditLogEntry, User } from '@tolti/contracts';
import { api } from '../api/client';

export function AuditPage() {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [users, setUsers] = useState<User[]>([]);
    const [actor, setActor] = useState('');
    const [event, setEvent] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<User[]>('/api/v1/users').then(setUsers).catch(() => undefined);
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const qs = new URLSearchParams();
                if (actor) qs.set('actor_id', actor);
                if (event) qs.set('event', event);
                qs.set('page_size', '100');
                const r = await api.get<{ items: AuditLogEntry[]; total: number }>(`/api/v1/audit?${qs}`);
                setEntries(r.items);
                setTotal(r.total);
            } finally {
                setLoading(false);
            }
        })();
    }, [actor, event]);

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">Audit log</div>
                    <div className="page-sub">{total} events on record. Append-only, complete history.</div>
                </div>
            </div>
            <div className="card">
                <div className="row" style={{ marginBottom: 'var(--s-4)' }}>
                    <select className="select" value={actor} onChange={(e) => setActor(e.target.value)}>
                        <option value="">All actors</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                    <input className="input" placeholder="Event (e.g. TASK_CREATED)" value={event} onChange={(e) => setEvent(e.target.value)} />
                </div>
                {loading ? (
                    <div className="empty"><span className="spinner" /></div>
                ) : entries.length === 0 ? (
                    <div className="empty">No events match.</div>
                ) : (
                    <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>When</th>
                                <th>Actor</th>
                                <th>Event</th>
                                <th>Target</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => (
                                <tr key={e.id}>
                                    <td className="mono muted">{new Date(e.created_at).toLocaleString()}</td>
                                    <td>{e.actor?.display_name ?? <span className="muted">—</span>}</td>
                                    <td><span className="audit-event">{e.event}</span></td>
                                    <td className="muted mono">{e.target_id ? e.target_id.slice(0, 8) : '—'}</td>
                                    <td className="muted mono">{e.ip_address ?? '—'}</td>
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
