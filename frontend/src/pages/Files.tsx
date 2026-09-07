import { useState } from 'react';
import type { Evidence, Task } from '@tolti/contracts';

export function FilesPage({
    rooms,
    evidenceOf,
    open,
}: {
    rooms: Task[];
    evidenceOf: (roomId: string) => Promise<Evidence[]>;
    open: (roomId: string) => void;
}) {
    const [openId, setOpenId] = useState<string | null>(null);
    const [cache, setCache] = useState<Record<string, Evidence[]>>({});
    const [loadingId, setLoadingId] = useState<string | null>(null);

    async function toggle(roomId: string) {
        if (openId === roomId) { setOpenId(null); return; }
        setOpenId(roomId);
        if (!cache[roomId]) {
            setLoadingId(roomId);
            try {
                const list = await evidenceOf(roomId);
                setCache((c) => ({ ...c, [roomId]: list }));
            } finally {
                setLoadingId(null);
            }
        }
    }

    const withFiles = rooms.filter((r) => (r.evidence_count ?? 0) > 0);

    return (
        <div className="page page-wide">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Files</h1>
                    <div className="page-sub">Evidence across your rooms. Upload lives inside each room, alongside the AI that uses it.</div>
                </div>
            </div>

            {rooms.length === 0 ? (
                <div className="empty">No rooms yet — create a chat first, then attach evidence inside it.</div>
            ) : withFiles.length === 0 ? (
                <div className="empty">No files uploaded yet. Open a room and use the paperclip or the Documents tab.</div>
            ) : (
                <div className="stack">
                    {withFiles.map((r) => (
                        <div className="card" key={r.id} style={{ padding: 0, overflow: 'hidden' }}>
                            <button
                                className="row-between"
                                style={{ width: '100%', padding: 'var(--s-4) var(--s-5)', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                                onClick={() => void toggle(r.id)}
                            >
                                <span className="row" style={{ gap: 10, minWidth: 0 }}>
                                    <span className="pill pill-accent">{r.kind === 'PRIVATE' ? 'private' : 'shared'}</span>
                                    <span style={{ color: 'var(--ink-1)' }} className="ellipsis">{r.title}</span>
                                </span>
                                <span className="row" style={{ gap: 10 }}>
                                    <span className="pill pill-muted">{r.evidence_count} file{(r.evidence_count ?? 0) === 1 ? '' : 's'}</span>
                                    <span className="muted">{openId === r.id ? '−' : '+'}</span>
                                </span>
                            </button>
                            {openId === r.id && (
                                <div style={{ borderTop: '1px solid var(--line)', padding: 'var(--s-3) var(--s-5)' }}>
                                    {loadingId === r.id ? (
                                        <div className="empty" style={{ padding: 'var(--s-4)' }}><span className="spinner" /></div>
                                    ) : (cache[r.id]?.length ?? 0) === 0 ? (
                                        <div className="muted" style={{ fontSize: 'var(--fz-small)' }}>Files were removed or are pending scan.</div>
                                    ) : (
                                        <div className="stack" style={{ gap: 6 }}>
                                            {cache[r.id]!.map((e) => (
                                                <div className="row-between" key={e.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                                                    <span className="row" style={{ gap: 10, minWidth: 0 }}>
                                                        <span className="pill pill-muted">{e.kind.toLowerCase()}</span>
                                                        <span className="ellipsis" style={{ maxWidth: 380, color: 'var(--ink-1)' }}>{e.filename}</span>
                                                        <span className="muted mono">{(e.byte_size / 1024).toFixed(1)} KB</span>
                                                        {e.ocr_completed ? <span className="pill pill-live">indexed</span> : <span className="pill pill-warn">pending</span>}
                                                    </span>
                                                    <span className="row" style={{ gap: 8 }}>
                                                        <button className="btn btn-sm btn-ghost" onClick={async () => {
                                                            const { url } = await import('../api/client').then((m) => m.api.get<{ url: string }>(`/api/v1/evidence/${e.id}/download`));
                                                            window.open(url, '_blank');
                                                        }}>Download</button>
                                                        <button className="btn btn-sm btn-ghost" onClick={() => open(r.id)}>Open room</button>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
