import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AIRun, Approval, Evidence, Message, PresenceEntry, Task, TaskMember, WorkspaceMember } from '@tolti/contracts';
import { api } from '../api/client';
import { useTaskSocket, type WSEvent } from '../api/ws';
import { hasRole, initialsOf, useAuth } from '../store/auth';
import {
    IconAlert, IconArrowUp, IconChat, IconChevronDown, IconCode, IconDoc, IconDownload,
    IconPaperclip, IconPlus, IconPulse, IconSend, IconSpark, IconSwap, IconTrash, IconUpload, IconUsers, IconX,
} from '../ui/icons';

type Tab = 'chat' | 'documents' | 'code' | 'agent';

export function RoomPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [task, setTask] = useState<Task | null>(null);
    const [missing, setMissing] = useState(false);
    const [members, setMembers] = useState<TaskMember[]>([]);      // room members (driver + invited)
    const [wsMembers, setWsMembers] = useState<WorkspaceMember[]>([]); // workspace roster (for invites)
    const [presence, setPresence] = useState<PresenceEntry[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [runs, setRuns] = useState<AIRun[]>([]);
    const [evidence, setEvidence] = useState<Evidence[]>([]);
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [tab, setTab] = useState<Tab>('chat');
    const [expandedRun, setExpandedRun] = useState<string | null>(null);
    const [handoffOpen, setHandoffOpen] = useState(false);
    const [peopleOpen, setPeopleOpen] = useState(false);
    const streamRef = useRef<HTMLDivElement | null>(null);

    const { connected, events } = useTaskSocket(id ?? null, !!id);

    // ── Initial load ─────────────────────────────────────────────
    useEffect(() => {
        if (!id) return;
        setMissing(false);
        (async () => {
            try {
                const t = await api.get<Task>(`/api/v1/tasks/${id}`);
                setTask(t);
                const [mem, wsm, msg, rn, ev, ap] = await Promise.all([
                    api.get<TaskMember[]>(`/api/v1/tasks/${id}/members`),
                    api.get<WorkspaceMember[]>(`/api/v1/workspaces/${t.workspace_id}/members`),
                    api.get<Message[]>(`/api/v1/tasks/${id}/messages`),
                    api.get<AIRun[]>(`/api/v1/tasks/${id}/ai/runs`),
                    api.get<Evidence[]>(`/api/v1/tasks/${id}/evidence`),
                    api.get<{ items: Approval[] }>(`/api/v1/approvals?task_id=${id}`),
                ]);
                setMembers(mem); setWsMembers(wsm); setMessages(msg); setRuns(rn); setEvidence(ev); setApprovals(ap.items);
            } catch {
                setMissing(true);
            }
        })();
    }, [id]);

    // ── Live updates ─────────────────────────────────────────────
    useEffect(() => {
        if (!events.length) return;
        for (const ev of events) applyEvent(ev);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [events]);

    function applyEvent(ev: WSEvent) {
        switch (ev.type) {
            case 'hello:ok':
                setTask(ev.payload.task);
                setMessages(ev.payload.initial_messages);
                setEvidence(ev.payload.initial_evidence);
                setPresence(ev.payload.initial_presence);
                break;
            case 'message:posted':
                setMessages((cur) => (cur.some((m) => m.id === ev.payload.message.id) ? cur : [...cur, ev.payload.message]));
                break;
            case 'evidence:uploaded':
                setEvidence((cur) => (cur.some((e) => e.id === ev.payload.evidence.id) ? cur : [ev.payload.evidence, ...cur]));
                break;
            case 'ai:started':
                setRuns((cur) => (cur.some((r) => r.id === ev.payload.run.id) ? cur : [ev.payload.run, ...cur]));
                break;
            case 'ai:progress':
                setRuns((cur) => cur.map((r) => (r.id === ev.payload.run_id ? { ...r, status: ev.payload.status } : r)));
                break;
            case 'ai:completed':
                setRuns((cur) => cur.map((r) => (r.id === ev.payload.run.id ? ev.payload.run : r)));
                break;
            case 'approval:requested':
                setApprovals((cur) => (cur.some((a) => a.id === ev.payload.approval.id) ? cur : [ev.payload.approval, ...cur]));
                break;
            case 'approval:decided':
                setApprovals((cur) => cur.map((a) => (a.id === ev.payload.approval.id ? ev.payload.approval : a)));
                break;
            case 'activity':
                if (ev.payload?.event === 'member_added' || ev.payload?.event === 'member_removed') {
                    void refreshMembers();
                }
                break;
            case 'task:state':
                setTask(ev.payload.task);
                break;
            case 'presence:update':
                setPresence((cur) => {
                    const others = cur.filter((p) => p.user_id !== ev.payload.user_id);
                    const tm = members.find((m) => m.user_id === ev.payload.user_id);
                    const wm = wsMembers.find((m) => m.user_id === ev.payload.user_id);
                    const name = tm?.display_name ?? wm?.user?.display_name ?? ev.payload.user_id.slice(0, 6);
                    return [...others, {
                        user_id: ev.payload.user_id,
                        display_name: name,
                        role: '',
                        status: ev.payload.status,
                        last_seen: new Date().toISOString(),
                    }];
                });
                break;
        }
    }

    useEffect(() => {
        streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
    }, [messages.length, runs.length]);

    const refreshMembers = useCallback(async () => {
        if (!id) return;
        try { setMembers(await api.get<TaskMember[]>(`/api/v1/tasks/${id}/members`)); } catch { /* */ }
    }, [id]);

    const online = useMemo(() => presence.filter((p) => p.status === 'ONLINE'), [presence]);
    const canInvite = useMemo(() => {
        if (!task || !user) return false;
        return task.driver_id === user.id || hasRole(user.system_roles, 'ADMIN');
    }, [task, user]);
    const driver = useMemo(() => {
        const m = members.find((mm) => mm.is_driver);
        const did = task?.driver_id;
        return { id: did, name: m?.display_name ?? did?.slice(0, 6) ?? '—', isMe: did === user?.id };
    }, [task, members, user]);

    if (missing) {
        return (
            <div className="page">
                <div className="empty">
                    This room does not exist, or it is a private chat you cannot access.
                    <div style={{ marginTop: 12 }}><Link className="btn" to="/rooms">Back to rooms</Link></div>
                </div>
            </div>
        );
    }
    if (!task) return <div className="page"><div className="empty"><span className="spinner" /> Opening room…</div></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {/* Header */}
            <div className="room-head">
                <div className="room-head-row">
                    <div>
                        <div className="breadcrumb">
                            <span>Workspace</span><span>/</span><span className="bc-here">{task.kind === 'PRIVATE' ? 'Private chat' : 'Shared room'}</span>
                        </div>
                        <h1 className="room-title">{task.title}</h1>
                    </div>
                    <div className="room-people">
                        <div className="avatar-stack" title={members.map((m) => m.display_name).join(', ')}>
                            {members.slice(0, 3).map((m) => (
                                <span key={m.user_id} className="avatar">{initialsOf(m.display_name)}</span>
                            ))}
                        </div>
                        <div className="rel">
                            <button className="btn btn-ghost btn-sm who-label" onClick={() => setPeopleOpen((v) => !v)}>
                                <IconUsers size={14} /> {members.length} {members.length === 1 ? 'person' : 'people'} · {online.length} online
                                <IconChevronDown size={11} />
                            </button>
                            {peopleOpen && (
                                <div className="pop" style={{ minWidth: 280 }}>
                                    <div className="pop-title">In this room</div>
                                    {members.map((m) => (
                                        <div className="pop-row" key={m.user_id}>
                                            <span className="row" style={{ gap: 8 }}>
                                                <span className="avatar" style={{ width: 24, height: 24, fontSize: 9 }}>{initialsOf(m.display_name)}</span>
                                                <span>
                                                    <span className="pr-main" style={{ display: 'block' }}>
                                                        {m.display_name}{m.is_driver ? ' · driving' : ''}
                                                    </span>
                                                    <span className="pr-sub">{m.email}</span>
                                                </span>
                                            </span>
                                            <span className="row" style={{ gap: 6 }}>
                                                {online.some((o) => o.user_id === m.user_id) && <span className="pill pill-live">online</span>}
                                                {canInvite && !m.is_driver && (
                                                    <button className="btn btn-sm btn-ghost" title="Remove from room"
                                                        onClick={async () => {
                                                            await api.del(`/api/v1/tasks/${task.id}/members/${m.user_id}`);
                                                            await refreshMembers();
                                                        }}>
                                                        <IconX size={12} />
                                                    </button>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                    {canInvite && (
                                        <>
                                            <div className="pop-sep" />
                                            <div className="pop-title">Invite from workspace</div>
                                            {wsMembers.filter((w) => !members.some((m) => m.user_id === w.user_id)).length === 0 ? (
                                                <div className="muted" style={{ padding: '2px 8px', fontSize: 'var(--fz-tiny)' }}>
                                                    Everyone in the workspace is already in this room.
                                                </div>
                                            ) : wsMembers.filter((w) => !members.some((m) => m.user_id === w.user_id)).map((w) => (
                                                <button key={w.user_id} className="pop-row" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                                                    onClick={async () => {
                                                        await api.post(`/api/v1/tasks/${task.id}/members`, { user_id: w.user_id });
                                                        await refreshMembers();
                                                    }}>
                                                    <span className="row" style={{ gap: 8 }}>
                                                        <span className="avatar" style={{ width: 24, height: 24, fontSize: 9 }}>{initialsOf(w.user?.display_name)}</span>
                                                        <span>
                                                            <span className="pr-main" style={{ display: 'block' }}>{w.user?.display_name ?? w.user_id.slice(0, 6)}</span>
                                                            <span className="pr-sub">{w.role.toLowerCase()}</span>
                                                        </span>
                                                    </span>
                                                    <span className="row" style={{ gap: 4, color: 'var(--accent)', fontSize: 'var(--fz-tiny)' }}>
                                                        <IconPlus size={11} /> Add
                                                    </span>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <Link className="btn btn-ghost btn-sm" to={`/activity?room=${task.id}`} title="Room activity">
                            <IconPulse size={14} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <TabBtn id="chat" label="Chat" Icon={IconChat} active={tab} set={setTab} />
                <TabBtn id="documents" label="Documents" Icon={IconDoc} active={tab} set={setTab} count={evidence.length} />
                <TabBtn id="code" label="Code" Icon={IconCode} active={tab} set={setTab} />
                <TabBtn id="agent" label="Agent" Icon={IconSpark} active={tab} set={setTab} count={runs.length} />
            </div>

            {/* Body */}
            <div className="room-body" ref={streamRef}>
                {tab === 'chat' && (
                    <div className="room-col">
                        {messages.length === 0 && runs.length === 0 ? (
                            <Guidance
                                onEvidence={() => setTab('documents')}
                                onNote={async () => {
                                    const prompt = 'Draft a short review note for this room: what was observed, what remains unknown, and what a teammate should check.';
                                    await startRun(prompt, 'TEXT');
                                }}
                            />
                        ) : (
                            <Stream
                                messages={messages}
                                runs={runs}
                                evidence={evidence}
                                expandedRun={expandedRun}
                                setExpandedRun={setExpandedRun}
                                onRetry={(p) => void startRun(p, 'TEXT')}
                                canConfigure={hasRole(user?.system_roles, 'ADMIN')}
                            />
                        )}
                    </div>
                )}
                {tab === 'documents' && (
                    <div className="room-col">
                        <Documents evidence={evidence} onUpload={(f) => void upload(f)} onDelete={(ev) => void removeEvidence(ev)} />
                    </div>
                )}
                {tab === 'code' && (
                    <div className="room-col">
                        <CodeTab
                            runs={runs}
                            onRun={(p) => void startRun(p, 'CODE')}
                            canConfigure={hasRole(user?.system_roles, 'ADMIN')}
                        />
                    </div>
                )}
                {tab === 'agent' && (
                    <div className="room-col">
                        <AgentTab
                            runs={runs}
                            approvals={approvals}
                            canConfigure={hasRole(user?.system_roles, 'ADMIN')}
                            canDecide={hasRole(user?.system_roles, 'SECURITY_APPROVER') || hasRole(user?.system_roles, 'ADMIN')}
                            onRetry={(p) => void startRun(p, 'TEXT')}
                            onRequestApproval={async () => {
                                await api.post('/api/v1/approvals', { task_id: task.id, kind: 'OUTPUT', summary: `Review outputs in “${task.title}”` });
                            }}
                            onDecide={async (aid, decision) => {
                                await api.post(`/api/v1/approvals/${aid}/decide`, { decision });
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Driving + composer */}
            <div className="composer-zone">
                <div className="composer-zone-inner">
                    <div className="drive-row">
                        <span className="drive-text">
                            <span className="dot" />
                            <span><b>{driver.isMe ? 'You' : driver.name}</b> {driver.isMe ? 'are' : 'is'} driving · Shared with the room</span>
                        </span>
                        <span className="drive-spacer" />
                        <span className="muted" style={{ fontSize: 'var(--fz-tiny)' }}>{connected ? 'live' : 'reconnecting…'}</span>
                        {driver.isMe && (
                            <button className="btn btn-sm" onClick={() => setHandoffOpen((v) => !v)}>
                                <IconSwap size={13} /> Hand off
                            </button>
                        )}
                        {handoffOpen && (
                            <div className="pop" style={{ right: 'auto', left: 0, bottom: 'calc(100% + 6px)', top: 'auto' }}>
                                <div className="pop-title">Hand this room to</div>
                                {members.filter((m) => m.user_id !== user?.id).length === 0 ? (
                                    <div className="muted" style={{ padding: '2px 8px', fontSize: 'var(--fz-tiny)' }}>
                                        Invite teammates first — handoff works within room members.
                                    </div>
                                ) : members.filter((m) => m.user_id !== user?.id).map((m) => (
                                    <button key={m.user_id} className="pop-row" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                                        onClick={async () => {
                                            await api.post(`/api/v1/tasks/${task.id}/handoff`, { to_user_id: m.user_id });
                                            setHandoffOpen(false);
                                        }}>
                                        <span className="pr-main">{m.display_name}</span>
                                        {m.is_driver && <span className="pill pill-accent">driver</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <Composer
                        hint={tab === 'code' ? 'Describe what the code agent should do…' : 'Ask the AI, or write to the room…'}
                        onSend={async (text) => {
                            await api.post(`/api/v1/tasks/${task.id}/messages`, { content: text });
                        }}
                        onReviewRun={async (text) => {
                            await api.post(`/api/v1/tasks/${task.id}/messages`, { content: text });
                            await startRun(text, tab === 'code' ? 'CODE' : 'TEXT');
                        }}
                        onAttach={(f) => void upload(f)}
                    />
                    <div className="status-line">
                        Local inference · {evidence.length === 0 ? 'No sources uploaded' : `${evidence.length} source${evidence.length === 1 ? '' : 's'} uploaded`}
                    </div>
                </div>
            </div>
        </div>
    );

    // ── Actions ──────────────────────────────────────────────────
    async function startRun(prompt: string, capability: 'TEXT' | 'CODE') {
        const evidenceIds = evidence.map((e) => e.id);
        const run = await api.post<AIRun>(`/api/v1/tasks/${task!.id}/ai/runs`, {
            task_id: task!.id,
            prompt,
            capability,
            evidence_ids: evidenceIds.length ? evidenceIds : undefined,
        });
        setRuns((cur) => [run, ...cur]);
        if (capability === 'CODE') setTab('code');
    }

    async function upload(file: File) {
        const kind = file.name.toLowerCase().endsWith('.pdf') ? 'PDF'
            : file.type.startsWith('image/') ? 'IMAGE' : 'TEXT';
        const pres = await api.post<{ evidence: Evidence; upload_url: string }>(`/api/v1/tasks/${task!.id}/evidence`, {
            task_id: task!.id,
            kind,
            filename: file.name,
            mime_type: file.type || 'application/octet-stream',
            byte_size: file.size,
        });
        const res = await fetch(pres.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        setEvidence((cur) => [pres.evidence, ...cur]);
    }

    async function removeEvidence(ev: Evidence) {
        await api.del(`/api/v1/evidence/${ev.id}`);
        setEvidence((cur) => cur.filter((e) => e.id !== ev.id));
    }
}

// ── Sub-components ───────────────────────────────────────────────

function IconChevron() {
    return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="m4 6 4 4 4-4" /></svg>;
}

function TabBtn({ id, label, Icon, active, set, count }: {
    id: Tab; label: string; Icon: typeof IconChat;
    active: Tab; set: (t: Tab) => void; count?: number;
}) {
    return (
        <button className={`tab ${active === id ? 'is-active' : ''}`} onClick={() => set(id)}>
            <Icon size={14} /> {label}
            {count !== undefined && count > 0 && <span className="pill pill-muted" style={{ padding: '0 6px' }}>{count}</span>}
        </button>
    );
}

function Guidance({ onEvidence, onNote }: { onEvidence: () => void; onNote: () => void }) {
    return (
        <div className="guide">
            <div className="guide-lead">Let’s organise the handover around three things your team can review together:</div>
            <div className="guide-item">
                <span className="guide-num">1</span>
                <span>
                    <h3>What was observed</h3>
                    <p>Record the source facts, without inferring a cause.</p>
                </span>
            </div>
            <div className="guide-item">
                <span className="guide-num">2</span>
                <span>
                    <h3>What remains unknown</h3>
                    <p>Keep missing measurements and open questions visible.</p>
                </span>
            </div>
            <div className="guide-item">
                <span className="guide-num">3</span>
                <span>
                    <h3>What needs review</h3>
                    <p>Turn the draft into a versioned note for a teammate to check.</p>
                </span>
            </div>
            <div className="guide-actions">
                <button className="btn" onClick={onEvidence}><IconDoc size={14} /> Look at the evidence</button>
                <button className="btn btn-accent" onClick={onNote}><IconSpark size={14} /> Prepare the note</button>
            </div>
        </div>
    );
}

function Stream({
    messages, runs, evidence, expandedRun, setExpandedRun, onRetry, canConfigure,
}: {
    messages: Message[];
    runs: AIRun[];
    evidence: Evidence[];
    expandedRun: string | null;
    setExpandedRun: (id: string | null) => void;
    onRetry: (prompt: string) => void;
    canConfigure: boolean;
}) {
    type Item = { t: number; kind: 'msg'; m: Message } | { t: number; kind: 'run'; r: AIRun };
    const items: Item[] = [
        ...messages.map((m) => ({ t: new Date(m.created_at).getTime(), kind: 'msg' as const, m })),
        ...runs.map((r) => ({ t: new Date(r.created_at).getTime() + 1, kind: 'run' as const, r })),
    ].sort((a, b) => a.t - b.t);

    const evName = (eid: string) => evidence.find((e) => e.id === eid)?.filename ?? 'evidence';

    return (
        <div className="stream">
            {items.map((it) =>
                it.kind === 'msg' ? (
                    <div key={it.m.id} className={`msg ${it.m.kind === 'SYSTEM' ? 'system' : ''}`}>
                        {it.m.kind !== 'SYSTEM' && <span className="avatar">{initialsOf(it.m.sender?.display_name)}</span>}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            {it.m.kind !== 'SYSTEM' && (
                                <div className="msg-head">
                                    <span className="msg-author">{it.m.sender?.display_name ?? 'Unknown'}</span>
                                    <span className="msg-time">{new Date(it.m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            )}
                            <div className="msg-body">{it.m.content}</div>
                        </div>
                    </div>
                ) : (
                    <RunCard
                        key={it.r.id}
                        run={it.r}
                        evidenceName={evName}
                        expanded={expandedRun === it.r.id}
                        onToggle={() => setExpandedRun(expandedRun === it.r.id ? null : it.r.id)}
                        onRetry={onRetry}
                        canConfigure={canConfigure}
                    />
                ),
            )}
        </div>
    );
}

function RunCard({
    run, evidenceName, expanded, onToggle, onRetry, canConfigure,
}: {
    run: AIRun;
    evidenceName: (id: string) => string;
    expanded: boolean;
    onToggle: () => void;
    onRetry: (prompt: string) => void;
    canConfigure: boolean;
}) {
    const [detail, setDetail] = useState<AIRun | null>(null);
    useEffect(() => {
        if (!expanded || detail) return;
        api.get<AIRun>(`/api/v1/ai/runs/${run.id}`).then(setDetail).catch(() => undefined);
    }, [expanded, detail, run.id]);

    const failed = run.status === 'FAILED';
    const running = run.status === 'QUEUED' || run.status === 'RUNNING';

    return (
        <div className="run">
            <div className="run-head">
                <IconSpark size={13} style={{ color: failed ? 'var(--danger)' : 'var(--accent)' }} />
                <span className={`pill ${failed ? 'pill-danger' : running ? 'pill-warn' : run.status === 'SUCCEEDED' ? 'pill-live' : 'pill-muted'}`}>
                    {running && <span className="spinner" style={{ width: 10, height: 10 }} />}
                    {run.status.toLowerCase()}
                </span>
                <span className="pill pill-muted">{run.capability.toLowerCase()}</span>
                <span className="run-q">“{run.prompt}”</span>
            </div>

            {failed ? (
                <div className="run-error">
                    <div className="re-title"><IconAlert size={14} /> Inference endpoint not reachable</div>
                    <div className="re-body">
                        The model endpoint for this capability did not respond, so this run could not produce an answer.
                        Your message and evidence are safe in the room.
                    </div>
                    {expanded && run.error && <div className="re-raw">{run.error}</div>}
                    <div className="re-actions">
                        <button className="btn btn-sm" onClick={() => onRetry(run.prompt)}>Retry</button>
                        {canConfigure && <Link className="btn btn-sm" to="/admin/models">Configure model</Link>}
                        <button className="btn btn-sm btn-ghost" onClick={onToggle}>{expanded ? 'Hide details' : 'Details'}</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="run-body">
                        {running ? (
                            <div className="row" style={{ color: 'var(--ink-3)' }}><span className="spinner" /> Working…</div>
                        ) : (
                            <RunAnswer text={run.response ?? ''} />
                        )}
                        {expanded && detail?.citations && detail.citations.length > 0 && (
                            <div className="run-cites">
                                {detail.citations.map((c) => (
                                    <div className="citation" key={c.id}>
                                        <span className="cite-src">{evidenceName(c.evidence_id)}{c.confidence != null ? ` · ${(c.confidence * 100).toFixed(0)}%` : ''}</span>
                                        <blockquote>“{c.quote}”</blockquote>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {!running && (
                        <div className="run-foot">
                            {run.token_usage?.total_tokens ? <span className="muted mono">{run.token_usage.total_tokens} tokens</span> : <span />}
                            <span style={{ flex: 1 }} />
                            {run.status === 'SUCCEEDED' && (
                                <button className="btn btn-sm btn-ghost" onClick={onToggle}>{expanded ? 'Hide citations' : 'Citations'}</button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function RunAnswer({ text }: { text: string }) {
    const parts = useMemo(() => splitFences(text), [text]);
    return (
        <div className="run-answer">
            {parts.map((p, i) =>
                p.fence ? <pre className="code-block" key={i}>{p.text}</pre> : <span key={i}>{p.text}</span>,
            )}
        </div>
    );
}

export { RunAnswer };

function splitFences(text: string): Array<{ fence: boolean; text: string }> {
    const out: Array<{ fence: boolean; text: string }> = [];
    const re = /```[\w]*\n([\s\S]*?)```/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push({ fence: false, text: text.slice(last, m.index) });
        out.push({ fence: true, text: m[1] ?? '' });
        last = re.lastIndex;
    }
    if (last < text.length) out.push({ fence: false, text: text.slice(last) });
    return out;
}

function Documents({ evidence, onUpload, onDelete }: {
    evidence: Evidence[];
    onUpload: (f: File) => void;
    onDelete: (e: Evidence) => void;
}) {
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);
    return (
        <div className="stack">
            <div className="row-between">
                <div>
                    <h2 style={{ fontSize: 'var(--fz-h2)' }}>Documents & evidence</h2>
                    <div className="muted" style={{ fontSize: 'var(--fz-small)' }}>
                        Everything here stays on-premise. Files are scanned (OCR) and indexed for retrieval.
                    </div>
                </div>
                <label className={`btn btn-accent ${busy ? '' : ''}`}>
                    {busy ? <span className="spinner" /> : <IconUpload size={14} />} Upload
                    <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { setBusy(true); Promise.resolve(onUpload(f)).finally(() => setBusy(false)); }
                        }}
                    />
                </label>
            </div>
            {evidence.length === 0 ? (
                <div className="empty">No documents yet. Upload PDFs, images or text to give the AI context.</div>
            ) : (
                <div className="table-wrap card" style={{ padding: 0 }}>
                    <table className="table">
                        <thead>
                            <tr><th>Name</th><th>Kind</th><th>Size</th><th>OCR</th><th>By</th><th>When</th><th /></tr>
                        </thead>
                        <tbody>
                            {evidence.map((e) => (
                                <tr key={e.id}>
                                    <td className="ellipsis" style={{ maxWidth: 260 }}>{e.filename}</td>
                                    <td><span className="pill pill-muted">{e.kind.toLowerCase()}</span></td>
                                    <td className="muted mono">{(e.byte_size / 1024).toFixed(1)} KB</td>
                                    <td>{e.ocr_completed ? <span className="pill pill-live">indexed</span> : <span className="pill pill-warn">pending</span>}</td>
                                    <td className="muted">{e.uploader?.display_name ?? '—'}</td>
                                    <td className="muted mono nowrap">{new Date(e.uploaded_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                                            <a className="btn btn-sm btn-ghost" href={`/api/v1/evidence/${e.id}/download`} onClick={async (ev) => {
                                                ev.preventDefault();
                                                const { url } = await api.get<{ url: string }>(`/api/v1/evidence/${e.id}/download`);
                                                window.open(url, '_blank');
                                            }}><IconDownload size={12} /></a>
                                            {(user?.id === e.uploaded_by || hasRole(user?.system_roles, 'ADMIN')) && (
                                                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => onDelete(e)}><IconTrash size={12} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function CodeTab({
    runs, onRun, canConfigure,
}: {
    runs: AIRun[];
    onRun: (p: string) => void;
    canConfigure: boolean;
}) {
    const [prompt, setPrompt] = useState('');
    const codeRuns = runs.filter((r) => r.capability === 'CODE');
    return (
        <div className="stack" style={{ maxWidth: 860 }}>
            <div>
                <h2 style={{ fontSize: 'var(--fz-h2)' }}>Code agent</h2>
                <div className="muted" style={{ fontSize: 'var(--fz-small)' }}>Runs on the code-specialist model. Answers include code blocks and explanations.</div>
            </div>
            {codeRuns.length === 0 ? (
                <div className="empty">No code runs yet. Ask the agent to write, review or explain something.</div>
            ) : (
                <div className="stack">
                    {[...codeRuns].reverse().map((r) => (
                        <RunCardSimple key={r.id} run={r} canConfigure={canConfigure} onRetry={onRun} />
                    ))}
                </div>
            )}
            <Composer
                hint="e.g. Write a bash script to archive last month’s sensor logs"
                onSend={async () => { /* code tab is AI-only */ }}
                onReviewRun={async (t) => { onRun(t); setPrompt(''); }}
                controlledText={[prompt, setPrompt]}
                runLabel="Run code agent"
            />
        </div>
    );
}

function RunCardSimple({ run, canConfigure, onRetry }: { run: AIRun; canConfigure: boolean; onRetry: (p: string) => void }) {
    const failed = run.status === 'FAILED';
    const running = run.status === 'QUEUED' || run.status === 'RUNNING';
    return (
        <div className="run">
            <div className="run-head">
                <IconCode size={13} style={{ color: failed ? 'var(--danger)' : 'var(--accent)' }} />
                <span className={`pill ${failed ? 'pill-danger' : running ? 'pill-warn' : 'pill-live'}`}>{run.status.toLowerCase()}</span>
                <span className="run-q">“{run.prompt}”</span>
            </div>
            {failed ? (
                <div className="run-error">
                    <div className="re-title"><IconAlert size={14} /> Inference endpoint not reachable</div>
                    <div className="re-actions">
                        <button className="btn btn-sm" onClick={() => onRetry(run.prompt)}>Retry</button>
                        {canConfigure && <Link className="btn btn-sm" to="/admin/models">Configure model</Link>}
                    </div>
                    {run.error && <div className="re-raw">{run.error}</div>}
                </div>
            ) : (
                <div className="run-body">
                    {running ? <div className="row" style={{ color: 'var(--ink-3)' }}><span className="spinner" /> Working…</div> : <RunAnswer text={run.response ?? ''} />}
                </div>
            )}
        </div>
    );
}

function AgentTab({
    runs, approvals, canConfigure, canDecide, onRetry, onRequestApproval, onDecide,
}: {
    runs: AIRun[];
    approvals: Approval[];
    canConfigure: boolean;
    canDecide: boolean;
    onRetry: (p: string) => void;
    onRequestApproval: () => Promise<void>;
    onDecide: (id: string, d: 'APPROVED' | 'REJECTED') => Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    const recent = runs.slice(0, 10);
    return (
        <div className="stack" style={{ maxWidth: 860 }}>
            <div className="row-between">
                <div>
                    <h2 style={{ fontSize: 'var(--fz-h2)' }}>Agent activity</h2>
                    <div className="muted" style={{ fontSize: 'var(--fz-small)' }}>Every AI run in this room, with its routing decision and result.</div>
                </div>
                <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { await onRequestApproval(); } finally { setBusy(false); } }}>
                    Request approval
                </button>
            </div>

            <div className="card">
                <div className="card-title">Approvals</div>
                {approvals.length === 0 ? (
                    <div className="muted">No approvals requested for this room.</div>
                ) : (
                    <div className="stack">
                        {approvals.map((a) => (
                            <div key={a.id} className="row-between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 'var(--s-2)' }}>
                                <span>
                                    <span className="row" style={{ gap: 8 }}>
                                        <span className={`pill ${a.state === 'APPROVED' ? 'pill-live' : a.state === 'REJECTED' ? 'pill-danger' : 'pill-warn'}`}>{a.state.toLowerCase()}</span>
                                        <span style={{ color: 'var(--ink-1)' }}>{a.summary}</span>
                                    </span>
                                    <span className="muted" style={{ display: 'block', fontSize: 'var(--fz-tiny)', marginTop: 2 }}>
                                        {a.kind.toLowerCase().replace('_', ' ')} · by {a.requester?.display_name ?? '—'}{a.decided_at ? ` · decided ${new Date(a.decided_at).toLocaleString()}` : ''}
                                    </span>
                                </span>
                                {a.state === 'PENDING' && canDecide && (
                                    <span className="row" style={{ gap: 6 }}>
                                        <button className="btn btn-sm btn-accent" onClick={() => void onDecide(a.id, 'APPROVED')}>Approve</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => void onDecide(a.id, 'REJECTED')}>Reject</button>
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {!canDecide && approvals.some((a) => a.state === 'PENDING') && (
                    <div className="muted" style={{ fontSize: 'var(--fz-tiny)', marginTop: 'var(--s-2)' }}>
                        A security approver or administrator decides gated outputs.
                    </div>
                )}
            </div>

            <div className="card">
                <div className="card-title">Runs</div>
                {recent.length === 0 ? (
                    <div className="muted">No AI runs yet.</div>
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead><tr><th>Prompt</th><th>Capability</th><th>Status</th><th>When</th><th /></tr></thead>
                            <tbody>
                                {recent.map((r) => (
                                    <tr key={r.id}>
                                        <td className="ellipsis" style={{ maxWidth: 280 }}>{r.prompt}</td>
                                        <td><span className="pill pill-muted">{r.capability.toLowerCase()}</span></td>
                                        <td>
                                            <span className={`pill ${r.status === 'FAILED' ? 'pill-danger' : r.status === 'SUCCEEDED' ? 'pill-live' : 'pill-warn'}`}>
                                                {r.status.toLowerCase()}
                                            </span>
                                        </td>
                                        <td className="muted mono nowrap">{new Date(r.created_at).toLocaleString()}</td>
                                        <td>{r.status === 'FAILED' && <button className="btn btn-sm btn-ghost" onClick={() => onRetry(r.prompt)}>Retry</button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {runs.some((r) => r.status === 'FAILED') && (
                    <div className="muted" style={{ fontSize: 'var(--fz-tiny)', marginTop: 'var(--s-2)' }}>
                        Failed runs keep their raw error — {canConfigure ? 'open Diagnostics or Models & routing to fix the endpoint.' : 'ask an administrator to check the model endpoint.'}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Composer ─────────────────────────────────────────────────────
function Composer({
    hint, onSend, onReviewRun, onAttach, runLabel = 'Review & run', controlledText,
}: {
    hint: string;
    onSend: (text: string) => Promise<void>;
    onReviewRun: (text: string) => Promise<void>;
    onAttach?: (f: File) => void;
    runLabel?: string;
    controlledText?: [string, (t: string) => void];
}) {
    const [internal, setInternal] = useState('');
    const text = controlledText ? controlledText[0] : internal;
    const setText = controlledText ? controlledText[1] : setInternal;
    const [busy, setBusy] = useState(false);
    const ref = useRef<HTMLTextAreaElement | null>(null);
    void controlledText;

    async function submit(kind: 'send' | 'run') {
        const t = text.trim();
        if (!t || busy) return;
        setBusy(true);
        try {
            if (kind === 'run') await onReviewRun(t);
            else await onSend(t);
            setText('');
            ref.current?.focus();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="composer">
            <textarea
                ref={ref}
                rows={1}
                placeholder={hint}
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit('send'); }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit('run'); }
                }}
            />
            <div className="composer-bar">
                {onAttach && (
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                        <IconPaperclip size={13} />
                        <input type="file" style={{ display: 'none' }} onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f && onAttach) onAttach(f);
                            e.currentTarget.value = '';
                        }} />
                    </label>
                )}
                <span className="model-chip"><IconSpark size={11} /> Auto route · evidence attached</span>
                <span className="cb-spacer" />
                <span className="kbd">⌘↵</span>
                <button className="btn btn-sm" disabled={busy} onClick={() => void submit('send')}>
                    <IconSend size={12} /> <span className="cb-send-label">Send to room</span>
                </button>
                <button className="btn btn-accent btn-sm" disabled={busy} onClick={() => void submit('run')}>
                    {busy ? <span className="spinner" /> : <IconArrowUp size={12} />} {runLabel}
                </button>
            </div>
        </div>
    );
}

