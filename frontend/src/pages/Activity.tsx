import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AIRun, Approval, Message, Task } from '@tolti/contracts';
import { api } from '../api/client';

type Entry = { t: number; room: Task; text: string; kind: 'msg' | 'run' | 'approval'; tone: 'live' | 'warn' | 'danger' | 'muted' };

export function ActivityPage({ rooms }: { rooms: Task[] }) {
    const [params, setParams] = useSearchParams();
    const roomFilter = params.get('room') ?? '';
    const [entries, setEntries] = useState<Entry[] | null>(null);

    const load = useCallback(async () => {
        const scope = roomFilter ? rooms.filter((r) => r.id === roomFilter) : rooms.slice(0, 10);
        const out: Entry[] = [];
        for (const room of scope) {
            try {
                const [msgs, runs, aps] = await Promise.all([
                    api.get<Message[]>(`/api/v1/tasks/${room.id}/messages?limit=30`),
                    api.get<AIRun[]>(`/api/v1/tasks/${room.id}/ai/runs`),
                    api.get<{ items: Approval[] }>(`/api/v1/approvals?task_id=${room.id}&page_size=10`),
                ]);
                for (const m of msgs) {
                    out.push({
                        t: new Date(m.created_at).getTime(), room,
                        kind: 'msg',
                        tone: m.kind === 'SYSTEM' ? 'muted' : 'muted',
                        text: m.kind === 'SYSTEM'
                            ? m.content
                            : `${m.sender?.display_name ?? 'Someone'}: ${m.content.slice(0, 140)}`,
                    });
                }
                for (const r of runs) {
                    out.push({
                        t: new Date(r.created_at).getTime(), room,
                        kind: 'run',
                        tone: r.status === 'FAILED' ? 'danger' : r.status === 'SUCCEEDED' ? 'live' : 'warn',
                        text: `AI ${r.capability.toLowerCase()} run “${r.prompt.slice(0, 80)}” → ${r.status.toLowerCase()}`,
                    });
                }
                for (const a of aps.items) {
                    out.push({
                        t: new Date(a.requested_at).getTime(), room,
                        kind: 'approval',
                        tone: a.state === 'APPROVED' ? 'live' : a.state === 'REJECTED' ? 'danger' : 'warn',
                        text: `Approval (${a.kind.toLowerCase().replace('_', ' ')}) “${a.summary.slice(0, 90)}” → ${a.state.toLowerCase()}`,
                    });
                }
            } catch { /* private or gone */ }
        }
        out.sort((a, b) => b.t - a.t);
        setEntries(out);
    }, [rooms, roomFilter]);

    useEffect(() => { void load(); }, [load]);

    return (
        <div className="page page-wide">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Room activity</h1>
                    <div className="page-sub">
                        Messages, AI runs and approvals — pick a room to focus the feed.
                    </div>
                </div>
            </div>

            {/* Room selector — the feed follows it */}
            <div className="row" style={{ marginBottom: 'var(--s-4)', flexWrap: 'wrap' }}>
                <button
                    className={`pill ${roomFilter === '' ? 'pill-accent' : 'pill-muted'}`}
                    style={{ cursor: 'pointer', fontSize: 'var(--fz-small)', padding: '5px 14px' }}
                    onClick={() => setParams({})}
                >
                    All rooms
                </button>
                {rooms.map((r) => (
                    <button
                        key={r.id}
                        className={`pill ${roomFilter === r.id ? 'pill-accent' : 'pill-muted'}`}
                        style={{ cursor: 'pointer', fontSize: 'var(--fz-small)', padding: '5px 14px', maxWidth: 240 }}
                        onClick={() => setParams({ room: r.id })}
                        title={r.title}
                    >
                        <span className="ellipsis">{r.title}</span>
                    </button>
                ))}
            </div>

            {entries === null ? (
                <div className="empty"><span className="spinner" /></div>
            ) : entries.length === 0 ? (
                <div className="empty">
                    {roomFilter
                        ? <>Nothing has happened in this room yet.</>
                        : 'Nothing has happened yet. Activity appears as your team works.'}
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    {entries.slice(0, 120).map((e, i) => (
                        <div key={`${e.room.id}-${e.t}-${i}`} className="row-between" style={{ padding: '10px var(--s-4)', borderBottom: '1px solid var(--line)' }}>
                            <span className="row" style={{ gap: 10, minWidth: 0 }}>
                                <span className={`pill ${e.tone === 'live' ? 'pill-live' : e.tone === 'danger' ? 'pill-danger' : e.tone === 'warn' ? 'pill-warn' : 'pill-muted'}`}>
                                    {e.kind}
                                </span>
                                <span className="ellipsis" style={{ minWidth: 0, color: 'var(--ink-2)' }}>{e.text}</span>
                            </span>
                            <span className="row" style={{ gap: 10, flex: 'none' }}>
                                <Link className="muted ellipsis" style={{ fontSize: 'var(--fz-tiny)', maxWidth: 160 }} to={`/rooms/${e.room.id}`}>{e.room.title}</Link>
                                <span className="muted mono nowrap" style={{ fontSize: 'var(--fz-tiny)' }}>{new Date(e.t).toLocaleString()}</span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
