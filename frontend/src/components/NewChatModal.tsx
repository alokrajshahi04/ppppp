import { useEffect, useMemo, useState } from 'react';
import type { Task, Workspace } from '@tolti/contracts';
import { api } from '../api/client';
import { IconChat, IconLock, IconX } from '../ui/icons';

export function NewChatModal({
    mode,
    workspaces,
    onClose,
    onCreated,
}: {
    mode: 'SHARED' | 'PRIVATE';
    workspaces: Workspace[];
    onClose: () => void;
    onCreated: (roomId: string) => void;
}) {
    const [kind, setKind] = useState<'SHARED' | 'PRIVATE'>(mode);
    // Default to the ACTIVE workspace — the rail is scoped to it, so a room
    // created anywhere else would not appear in the sidebar.
    const [wsId, setWsId] = useState(() => {
        const active = localStorage.getItem('tolti.ws');
        return active && workspaces.some((w) => w.id === active) ? active : workspaces[0]?.id ?? '';
    });
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const valid = useMemo(() => title.trim().length > 0 && !!wsId, [title, wsId]);

    async function create() {
        if (!valid || busy) return;
        setBusy(true);
        setErr(null);
        try {
            const room = await api.post<Task>('/api/v1/tasks', {
                workspace_id: wsId,
                title: title.trim(),
                kind,
            });
            window.dispatchEvent(new CustomEvent('tolti:rooms-changed'));
            onCreated(room.id);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not create the chat.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" role="dialog" aria-modal>
                <div className="row-between">
                    <div>
                        <div className="modal-title">New chat</div>
                        <div className="modal-sub">A chat is a shared AI room scoped to a workspace.</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><IconX size={14} /></button>
                </div>

                <button className={`kind-choice ${kind === 'SHARED' ? 'is-selected' : ''}`} onClick={() => setKind('SHARED')}>
                    <span className="kc-icon"><IconChat size={16} /></span>
                    <span>
                        <h3>Shared chat</h3>
                        <p>Everyone in the workspace can join, see the evidence and work the task with you.</p>
                    </span>
                </button>
                <button className={`kind-choice ${kind === 'PRIVATE' ? 'is-selected' : ''}`} onClick={() => setKind('PRIVATE')}>
                    <span className="kc-icon"><IconLock size={15} /></span>
                    <span>
                        <h3>Private chat</h3>
                        <p>Visible only to you. An administrator can still audit access, but teammates cannot open it.</p>
                    </span>
                </button>

                <div className="field" style={{ marginTop: 'var(--s-4)' }}>
                    <label className="field-label">Title</label>
                    <input
                        className="input"
                        placeholder={kind === 'SHARED' ? 'e.g. Pump 7 vibration investigation' : 'e.g. Draft maintenance summary'}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
                        autoFocus
                    />
                </div>
                <div className="field">
                    <label className="field-label">Workspace</label>
                    <select className="select" value={wsId} onChange={(e) => setWsId(e.target.value)}>
                        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>

                {err && <div className="banner banner-error">{err}</div>}

                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'var(--s-2)' }}>
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-accent" onClick={() => void create()} disabled={!valid || busy}>
                        {busy ? <span className="spinner" /> : <>Create {kind === 'SHARED' ? 'shared chat' : 'private chat'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
