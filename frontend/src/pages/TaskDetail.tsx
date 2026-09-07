import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Task, Evidence, Message, AIRun, Approval, PresenceEntry } from '@tolti/contracts';
import { api } from '../api/client';
import { useTaskSocket } from '../api/ws';
import { useAuth } from '../store/auth';

export function TaskDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [task, setTask] = useState<Task | null>(null);
    const [evidence, setEvidence] = useState<Evidence[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [runs, setRuns] = useState<AIRun[]>([]);
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [presence, setPresence] = useState<PresenceEntry[]>([]);
    const [draft, setDraft] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const { connected, events } = useTaskSocket(id ?? null, !!id);

    // Initial fetch
    useEffect(() => {
        if (!id) return;
        (async () => {
            const [t, ev, msg, rs, ap] = await Promise.all([
                api.get<Task>(`/api/v1/tasks/${id}`),
                api.get<Evidence[]>(`/api/v1/tasks/${id}/evidence`),
                api.get<Message[]>(`/api/v1/tasks/${id}/messages`),
                api.get<AIRun[]>(`/api/v1/tasks/${id}/ai/runs`),
                api.get<{ items: Approval[] }>(`/api/v1/approvals?task_id=${id}`),
            ]);
            setTask(t);
            setEvidence(ev);
            setMessages(msg);
            setRuns(rs);
            setApprovals(ap.items);
        })();
    }, [id]);

    // Apply WS events
    useEffect(() => {
        if (!events.length) return;
        const latest = events[events.length - 1]!;
        switch (latest.type) {
            case 'hello:ok':
                setTask(latest.payload.task);
                setMessages(latest.payload.initial_messages);
                setEvidence(latest.payload.initial_evidence);
                setPresence(latest.payload.initial_presence);
                break;
            case 'message:posted':
                setMessages((cur) => [...cur, latest.payload.message]);
                break;
            case 'evidence:uploaded':
                setEvidence((cur) => [latest.payload.evidence, ...cur]);
                break;
            case 'ai:started':
                setRuns((cur) => [latest.payload.run, ...cur]);
                break;
            case 'ai:completed':
                setRuns((cur) => cur.map((r) => (r.id === latest.payload.run.id ? latest.payload.run : r)));
                break;
            case 'approval:requested':
                setApprovals((cur) => [latest.payload.approval, ...cur]);
                break;
            case 'approval:decided':
                setApprovals((cur) => cur.map((a) => (a.id === latest.payload.approval.id ? latest.payload.approval : a)));
                break;
            case 'task:state':
                setTask(latest.payload.task);
                break;
            case 'presence:update':
                setPresence((cur) => {
                    const others = cur.filter((p) => p.user_id !== latest.payload.user_id);
                    return [...others, {
                        user_id: latest.payload.user_id,
                        display_name: latest.payload.user_id.slice(0, 8),
                        role: '',
                        status: latest.payload.status,
                        last_seen: new Date().toISOString(),
                    }];
                });
                break;
        }
    }, [events]);

    const onlineUsers = useMemo(() => presence.filter((p) => p.status === 'ONLINE'), [presence]);

    if (!task) return <div className="page"><div className="empty"><span className="spinner" /> Loading…</div></div>;

    async function postMessage() {
        if (!draft.trim() || !id) return;
        try {
            await api.post<Message>(`/api/v1/tasks/${id}/messages`, { content: draft });
            setDraft('');
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'post failed');
        }
    }

    async function startAIRun() {
        if (!aiPrompt.trim() || !id) return;
        setBusy(true);
        setErr(null);
        try {
            const evidenceIds = evidence.map((e) => e.id);
            await api.post<AIRun>(`/api/v1/tasks/${id}/ai/runs`, {
                task_id: id,
                prompt: aiPrompt,
                evidence_ids: evidenceIds.length ? evidenceIds : undefined,
            });
            setAiPrompt('');
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'ai run failed');
        } finally {
            setBusy(false);
        }
    }

    async function uploadFile(file: File) {
        if (!id) return;
        try {
            const pres = await api.post<{ evidence: Evidence; upload_url: string; storage_key: string }>(
                `/api/v1/tasks/${id}/evidence`,
                {
                    task_id: id,
                    kind: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE',
                    filename: file.name,
                    mime_type: file.type || 'application/octet-stream',
                    byte_size: file.size,
                },
            );
            await fetch(pres.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'upload failed');
        }
    }

    async function requestApproval(target?: { id: string; kind: 'OUTPUT' | 'ACTION' | 'REPORT' | 'SENSITIVE_FINDING'; summary: string }) {
        if (!id) return;
        try {
            await api.post<Approval>(`/api/v1/approvals`, {
                task_id: id,
                kind: target?.kind ?? 'OUTPUT',
                target_id: target?.id,
                summary: target?.summary ?? 'Approval requested for sensitive output',
            });
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'approval failed');
        }
    }

    async function decide(approvalId: string, decision: 'APPROVED' | 'REJECTED') {
        try {
            await api.post<Approval>(`/api/v1/approvals/${approvalId}/decide`, { decision });
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'decide failed');
        }
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">{task.title}</div>
                    <div className="page-sub row" style={{ gap: 8 }}>
                        <span className={`pill pill-${task.status === 'COMPLETED' ? 'success' : task.status === 'AWAITING_APPROVAL' ? 'pending' : 'info'}`}>{task.status.replace('_', ' ')}</span>
                        <span className="muted">·</span>
                        <span className="muted">{task.priority}</span>
                        <span className="muted">·</span>
                        <span className="muted mono">{connected ? 'live' : 'disconnected'}</span>
                    </div>
                </div>
                <div className="row">
                    {onlineUsers.length > 0 && (
                        <div className="presence online">{onlineUsers.length} online</div>
                    )}
                    <button className="btn" onClick={() => requestApproval()}>Request approval</button>
                </div>
            </div>

            {err && <div className="banner banner-error">{err}</div>}

            <div className="task-grid">
                <div className="stack">
                    <div className="card">
                        <div className="card-title">Conversation</div>
                        <div className="chat">
                            {messages.length === 0 && <div className="empty">No messages yet.</div>}
                            {messages.map((m) => (
                                <div key={m.id} className={`chat-msg ${m.kind === 'AI' ? 'ai' : m.kind === 'USER' ? 'user' : ''}`}>
                                    <div className="meta">{m.kind} · {new Date(m.created_at).toLocaleTimeString()}</div>
                                    <div>{m.content}</div>
                                </div>
                            ))}
                        </div>
                        <div className="chat-input">
                            <input
                                className="input"
                                placeholder="Send a message to the team…"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') postMessage(); }}
                            />
                            <button className="btn btn-primary" onClick={postMessage}>Send</button>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Ask the AI</div>
                        <textarea className="textarea" placeholder="What do you want the AI to investigate? It will pull RAG context from all attached evidence." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                        <div className="row" style={{ marginTop: 'var(--s-3)' }}>
                            <button className="btn btn-primary" onClick={startAIRun} disabled={busy}>
                                {busy ? <span className="spinner" /> : 'Start AI run'}
                            </button>
                            <span className="muted">{evidence.length} evidence attached</span>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">AI runs</div>
                        {runs.length === 0 ? (
                            <div className="empty">No AI runs yet.</div>
                        ) : (
                            <div className="stack">
                                {runs.map((r) => (
                                    <div key={r.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 'var(--s-2)' }}>
                                        <div className="row-between">
                                            <div className="row" style={{ gap: 8 }}>
                                                <span className={`pill pill-${r.status === 'SUCCEEDED' ? 'success' : r.status === 'FAILED' ? 'danger' : 'pending'}`}>{r.status}</span>
                                                <span className="muted">{r.capability}</span>
                                                <span className="muted mono">{r.model_id}</span>
                                            </div>
                                            <button className="btn btn-sm btn-ghost" onClick={() => requestApproval({ id: r.id, kind: 'OUTPUT', summary: `Approve AI output for ${r.capability}` })}>Request approval</button>
                                        </div>
                                        {r.response && <div style={{ marginTop: 'var(--s-2)' }}>{r.response}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="task-side">
                    <div className="card">
                        <div className="card-title">Evidence</div>
                        <label className="btn" style={{ width: '100%', justifyContent: 'center' }}>
                            Upload file
                            <input
                                type="file"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) uploadFile(f);
                                }}
                            />
                        </label>
                        {evidence.length === 0 ? (
                            <div className="muted" style={{ marginTop: 'var(--s-3)' }}>No evidence uploaded.</div>
                        ) : (
                            <div className="stack" style={{ marginTop: 'var(--s-3)' }}>
                                {evidence.map((e) => (
                                    <div key={e.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 'var(--s-2)' }}>
                                        <div>{e.filename}</div>
                                        <div className="muted" style={{ fontSize: 'var(--fz-small)' }}>
                                            {e.kind} · {(e.byte_size / 1024).toFixed(1)} KB · {e.ocr_completed ? 'OCR ✓' : 'OCR pending'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <div className="card-title">Approvals</div>
                        {approvals.length === 0 ? (
                            <div className="muted">No approvals requested.</div>
                        ) : (
                            <div className="stack">
                                {approvals.map((a) => (
                                    <div key={a.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 'var(--s-2)' }}>
                                        <div className="row-between">
                                            <div className="row" style={{ gap: 8 }}>
                                                <span className={`pill pill-${a.state === 'APPROVED' ? 'success' : a.state === 'REJECTED' ? 'danger' : 'pending'}`}>{a.state}</span>
                                                <span className="muted">{a.kind}</span>
                                            </div>
                                            {a.state === 'PENDING' && user?.system_roles.some((r) => r === 'SECURITY_APPROVER' || r === 'ADMIN') && (
                                                <div className="row">
                                                    <button className="btn btn-sm btn-primary" onClick={() => decide(a.id, 'APPROVED')}>Approve</button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => decide(a.id, 'REJECTED')}>Reject</button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ marginTop: 'var(--s-1)' }}>{a.summary}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <div className="card-title">People in this task</div>
                        {presence.length === 0 ? (
                            <div className="muted">Nobody online.</div>
                        ) : (
                            <div className="stack">
                                {presence.map((p) => (
                                    <div key={p.user_id} className="row-between">
                                        <span>{p.display_name}</span>
                                        <span className={`pill pill-${p.status === 'ONLINE' ? 'success' : 'pending'}`}>{p.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
