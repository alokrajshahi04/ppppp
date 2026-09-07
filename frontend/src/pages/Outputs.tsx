import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AIRun, Task } from '@tolti/contracts';
import { api } from '../api/client';
import { RunAnswer } from './Room';

export function OutputsPage({ rooms }: { rooms: Task[] }) {
    const [groups, setGroups] = useState<Array<{ room: Task; runs: AIRun[] }> | null>(null);

    const load = useCallback(async () => {
        const recent = rooms.slice(0, 12);
        const out: Array<{ room: Task; runs: AIRun[] }> = [];
        for (const room of recent) {
            try {
                const runs = await api.get<AIRun[]>(`/api/v1/tasks/${room.id}/ai/runs`);
                if (runs.length) out.push({ room, runs });
            } catch { /* private or gone */ }
        }
        setGroups(out);
    }, [rooms]);

    useEffect(() => { void load(); }, [load]);

    return (
        <div className="page page-wide">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Outputs</h1>
                    <div className="page-sub">What the agents produced across your rooms — answers, drafts and code.</div>
                </div>
            </div>

            {groups === null ? (
                <div className="empty"><span className="spinner" /></div>
            ) : groups.length === 0 ? (
                <div className="empty">
                    No AI outputs yet. Open a room and use <b>Review &amp; run</b> — results land here.
                    <div style={{ marginTop: 12 }}><Link className="btn" to="/rooms">Go to rooms</Link></div>
                </div>
            ) : (
                <div className="stack">
                    {groups.map(({ room, runs }) => (
                        <div key={room.id} className="card">
                            <div className="row-between" style={{ marginBottom: 'var(--s-3)' }}>
                                <Link to={`/rooms/${room.id}`} style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{room.title}</Link>
                                <span className="pill pill-muted">{runs.length} run{runs.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="stack" style={{ gap: 'var(--s-3)' }}>
                                {runs.slice(0, 4).map((r) => (
                                    <div key={r.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s-3)' }}>
                                        <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                            <span className={`pill ${r.status === 'FAILED' ? 'pill-danger' : r.status === 'SUCCEEDED' ? 'pill-live' : 'pill-warn'}`}>{r.status.toLowerCase()}</span>
                                            <span className="pill pill-muted">{r.capability.toLowerCase()}</span>
                                            <span className="muted ellipsis" style={{ fontSize: 'var(--fz-small)', flex: 1, minWidth: 160 }}>“{r.prompt}”</span>
                                            <span className="muted mono nowrap" style={{ fontSize: 'var(--fz-tiny)' }}>{new Date(r.created_at).toLocaleString()}</span>
                                        </div>
                                        {r.status === 'SUCCEEDED' && r.response && (
                                            <div style={{ maxHeight: 140, overflow: 'hidden' }}>
                                                <RunAnswer text={r.response} />
                                            </div>
                                        )}
                                        {r.status === 'FAILED' && (
                                            <div className="muted" style={{ fontSize: 'var(--fz-small)' }}>Inference endpoint not reachable — retry from the room.</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {runs.length > 4 && (
                                <div style={{ marginTop: 'var(--s-3)' }}>
                                    <Link className="btn btn-sm btn-ghost" to={`/rooms/${room.id}`}>View all in room →</Link>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
