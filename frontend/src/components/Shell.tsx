import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { HealthResponse, ModelConfig, Notification, Task, Workspace } from '@tolti/contracts';
import { api } from '../api/client';
import { hasRole, initialsOf, loadWorkspaces, setActiveWorkspaceId, useAuth } from '../store/auth';
import { NewChatModal } from './NewChatModal';
import { DiagnosticsPop } from './Diagnostics';
import {
    IconBell, IconChat, IconChevronDown, IconFolder, IconGrid,
    IconLock, IconPlus, IconPulse, IconX,
} from '../ui/icons';

// ── Health hook (shared by status bar + rail inference card) ─────
export interface SysStatus {
    health: HealthResponse | null;
    models: ModelConfig[];
    load: () => void;
}

export function useSysStatus(pollMs = 30000): SysStatus {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [models, setModels] = useState<ModelConfig[]>([]);
    const load = useCallback(async () => {
        try {
            const h = await api.get<HealthResponse>('/health');
            setHealth(h && typeof h === 'object' && 'services' in h ? h : null);
        } catch { setHealth(null); }
        try { setModels(await api.get<ModelConfig[]>('/api/v1/models')); } catch { setModels([]); }
    }, []);
    useEffect(() => {
        void load();
        const t = window.setInterval(() => void load(), pollMs);
        return () => window.clearInterval(t);
    }, [load, pollMs]);
    return { health, models, load };
}

// ── Top status bar ───────────────────────────────────────────────
function TopStatusBar({ sys, title }: { sys: SysStatus; title: string }) {
    const { user } = useAuth();
    const [diagOpen, setDiagOpen] = useState(false);
    const [bellOpen, setBellOpen] = useState(false);
    const [notifs, setNotifs] = useState<Notification[]>([]);
    const isAdmin = hasRole(user?.system_roles, 'ADMIN');

    const loadNotifs = useCallback(async () => {
        try { setNotifs(await api.get<Notification[]>('/api/v1/notifications?unread=true')); } catch { /* */ }
    }, []);
    useEffect(() => { void loadNotifs(); }, [loadNotifs]);

    const engine = sys.health?.services?.ai_engine ?? 'down';
    const textModels = sys.models.filter((m) => m.capability === 'TEXT');
    const modelLine = engine === 'ok'
        ? (textModels.length ? `Local inference · Model: ${textModels.find((m) => m.is_default)?.model_id ?? 'default'}` : 'Local inference · Model: Not configured')
        : 'Local inference · AI engine offline';

    return (
        <div className="topbar">
            <button className="hamburger" aria-label="Toggle navigation" onClick={() => window.dispatchEvent(new CustomEvent('tolti:toggle-rail'))}>
                <span /><span /><span />
            </button>
            <div className="topbar-context">
                <span className="t-title">{title}</span>
                <span className="t-sub">{modelLine}</span>
            </div>
            <div className="topbar-spacer" />
            <div className="topbar-actions">
                <div className="rel">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setBellOpen((v) => !v); setDiagOpen(false); if (!bellOpen) void loadNotifs(); }}>
                        <IconBell size={15} />
                        {notifs.length > 0 && <span className="pill pill-accent">{notifs.length}</span>}
                    </button>
                    {bellOpen && (
                        <div className="pop" style={{ minWidth: 300 }}>
                            <div className="pop-title">Notifications</div>
                            {notifs.length === 0 ? (
                                <div className="muted" style={{ padding: '4px 8px', fontSize: 'var(--fz-small)' }}>Nothing unread.</div>
                            ) : notifs.slice(0, 8).map((n) => (
                                <button key={n.id} className="pop-row" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                                    onClick={async () => { await api.post(`/api/v1/notifications/${n.id}/read`); void loadNotifs(); }}>
                                    <span>
                                        <span className="pr-main" style={{ display: 'block' }}>{n.title}</span>
                                        {n.body && <span className="pr-sub">{n.body}</span>}
                                    </span>
                                    <IconX size={12} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="rel">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setDiagOpen((v) => !v); setBellOpen(false); }}>
                        Diagnostics <IconChevronDown size={12} />
                    </button>
                    {diagOpen && <DiagnosticsPop sys={sys} isAdmin={isAdmin} onClose={() => setDiagOpen(false)} />}
                </div>
            </div>
        </div>
    );
}

const ROOM_PREVIEW = 3; // rooms shown per section before expanding

// ── Room section (3 previews + kebab collapse) ───────────────────
function RoomSection({
    label, rooms, activeId, onOpen, empty,
}: {
    label: string;
    rooms: Task[];
    activeId: string | null;
    onOpen: (id: string) => void;
    empty: ReactNode;
}) {
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? rooms : rooms.slice(0, ROOM_PREVIEW);
    return (
        <div className="rail-section">
            <div className="rail-label">
                <span>{label}</span>
                <span className="row" style={{ gap: 6 }}>
                    <span>{String(rooms.length).padStart(2, '0')}</span>
                    {rooms.length > ROOM_PREVIEW && (
                        <button
                            className="rail-kebab"
                            aria-label={expanded ? 'Show fewer' : 'Show all'}
                            title={expanded ? 'Show fewer' : `Show all ${rooms.length}`}
                            onClick={() => setExpanded((v) => !v)}
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                                {expanded
                                    ? <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    : <><circle cx="3.2" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.8" cy="8" r="1.3" /></>}
                            </svg>
                        </button>
                    )}
                </span>
            </div>
            {rooms.length === 0 && empty}
            {shown.map((r) => (
                <button
                    key={r.id}
                    className={`room-item ${activeId === r.id ? 'is-active' : ''}`}
                    onClick={() => onOpen(r.id)}
                    title={r.title}
                >
                    {r.kind === 'PRIVATE' ? <IconLock size={13} className="ri-lock" /> : <IconChat size={14} />}
                    <span style={{ minWidth: 0 }}>
                        <span className="ri-title" style={{ display: 'block' }}>{r.title}</span>
                        <span className="ri-meta">{r.message_count ?? 0} messages · {r.status.replace('_', ' ').toLowerCase()}</span>
                    </span>
                </button>
            ))}
            {!expanded && rooms.length > ROOM_PREVIEW && (
                <button className="rail-viewall" onClick={() => setExpanded(true)}>
                    View all {rooms.length} →
                </button>
            )}
        </div>
    );
}

// ── Shell ────────────────────────────────────────────────────────
export function Shell({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [railOpen, setRailOpen] = useState(false);
    const [newChat, setNewChat] = useState<null | 'SHARED' | 'PRIVATE'>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [rooms, setRooms] = useState<Task[]>([]);
    const [profileOpen, setProfileOpen] = useState(false);
    const [wsOpen, setWsOpen] = useState(false);
    const sys = useSysStatus();

    const isAuthed = !!user;
    const isAdmin = hasRole(user?.system_roles, 'ADMIN');

    const [wsTick, setWsTick] = useState(0);

    const reloadRooms = useCallback(async () => {
        if (!user) return;
        try {
            const list = await loadWorkspaces();
            setWorkspaces(list);
            // Scope the rail to the active workspace — switching workspaces
            // changes which rooms appear, their counts, and the activity feed.
            const active = localStorage.getItem('tolti.ws');
            const qs = new URLSearchParams({ page_size: '50' });
            if (active) qs.set('workspace_id', active);
            const r = await api.get<{ items: Task[] }>(`/api/v1/tasks?${qs}`);
            setRooms(r.items);
        } catch { /* session may be settling */ }
    }, [user, wsTick]);

    useEffect(() => { void reloadRooms(); }, [reloadRooms, location.pathname]);
    useEffect(() => {
        const roomsChanged: EventListener = () => { void reloadRooms(); };
        const wsChanged: EventListener = () => setWsTick((t) => t + 1);
        window.addEventListener('tolti:rooms-changed', roomsChanged);
        window.addEventListener('tolti:ws-changed', wsChanged);
        return () => {
            window.removeEventListener('tolti:rooms-changed', roomsChanged);
            window.removeEventListener('tolti:ws-changed', wsChanged);
        };
    }, [reloadRooms]);
    useEffect(() => {
        const toggle = () => setRailOpen((v) => !v);
        window.addEventListener('tolti:toggle-rail', toggle);
        return () => window.removeEventListener('tolti:toggle-rail', toggle);
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setNewChat('SHARED');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!isAuthed) return <>{children}</>;

    const activeWsId = localStorage.getItem('tolti.ws');
    const activeWs = workspaces.find((w) => w.id === activeWsId) ?? workspaces[0];
    const shared = rooms.filter((r) => r.kind !== 'PRIVATE');
    const privates = rooms.filter((r) => r.kind === 'PRIVATE');
    const isRoom = location.pathname.startsWith('/rooms/');

    const railItem = (to: string, label: string, Icon: typeof IconFolder) => (
        <NavLink to={to} onClick={() => setRailOpen(false)} className={({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`}>
            <Icon size={15} /> {label}
        </NavLink>
    );

    const switchWorkspace = (id: string) => {
        setActiveWorkspaceId(id);
        setWsOpen(false);
        window.dispatchEvent(new CustomEvent('tolti:ws-changed'));
        if (isRoom) navigate('/rooms');
    };

    return (
        <div className="app">
            {railOpen && <div className="scrim" style={{ zIndex: 60 }} onClick={() => setRailOpen(false)} />}
            <aside className={`rail ${railOpen ? 'is-open' : ''}`}>
                {/* Fixed head: brand */}
                <div className="rail-brand"><span className="logo">t</span> TOLTI AI</div>

                {/* Workspace selector — restored full-width block */}
                <div className="rel" style={{ margin: 'var(--s-2) var(--s-3) 0' }}>
                    <button className="rail-workspace" onClick={() => setWsOpen((v) => !v)} title="Switch workspace">
                        <span className="ws-avatar">{initialsOf(activeWs?.name).slice(0, 2)}</span>
                        <span style={{ minWidth: 0 }}>
                            <span className="ws-name" style={{ display: 'block' }}>{activeWs?.name ?? 'Workspace'}</span>
                            <span className="ws-sub">Team workspace</span>
                        </span>
                        <IconChevronDown size={13} style={{ marginLeft: 'auto', color: 'var(--ink-3)', flex: 'none' }} />
                    </button>
                    {wsOpen && (
                        <div className="pop" style={{ left: 0, right: 'auto', minWidth: 240 }}>
                            <div className="pop-title">Workspaces</div>
                            {workspaces.map((w) => (
                                <button key={w.id} className="pop-row" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                                    onClick={() => switchWorkspace(w.id)}>
                                    <span className="row" style={{ gap: 8 }}>
                                        <span className="ws-avatar" style={{ width: 24, height: 24, fontSize: 9 }}>{initialsOf(w.name).slice(0, 2)}</span>
                                        <span>
                                            <span className="pr-main" style={{ display: 'block' }}>{w.name}</span>
                                            <span className="pr-sub">{w.member_count ?? 1} member{(w.member_count ?? 1) === 1 ? '' : 's'}</span>
                                        </span>
                                    </span>
                                    {w.id === activeWs?.id && <span className="pill pill-accent">current</span>}
                                </button>
                            ))}
                            <div className="pop-sep" />
                            <button className="pop-row" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', color: 'var(--ink-1)', fontSize: 'var(--fz-small)', cursor: 'pointer' }}
                                onClick={() => { setWsOpen(false); navigate('/workspaces'); setRailOpen(false); }}>
                                <span className="pr-main">Manage workspaces</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Scrollable middle */}
                <div className="rail-scroll">
                    <div className="rail-actions">
                        <button className="rail-new" onClick={() => setNewChat('SHARED')}>
                            <IconPlus size={14} /> New chat <span className="kbd">⌘K</span>
                        </button>
                    </div>

                    <div className="rail-section">
                        {railItem('/files', 'Files', IconFolder)}
                        {railItem('/outputs', 'Outputs', IconGrid)}
                        {railItem('/activity', 'Room activity', IconPulse)}
                    </div>

                    <RoomSection
                        label="Shared rooms"
                        rooms={shared}
                        activeId={isRoom ? location.pathname.split('/')[2] ?? null : null}
                        onOpen={(id) => { navigate(`/rooms/${id}`); setRailOpen(false); }}
                        empty={<div className="rail-note">No shared rooms yet. Create one with <span className="kbd">⌘K</span>.</div>}
                    />

                    {privates.length > 0 && (
                        <RoomSection
                            label="Private chats"
                            rooms={privates}
                            activeId={isRoom ? location.pathname.split('/')[2] ?? null : null}
                            onOpen={(id) => { navigate(`/rooms/${id}`); setRailOpen(false); }}
                            empty={<div className="rail-note">No private chats yet.</div>}
                        />
                    )}
                </div>

                {/* Sticky footer — profile only (inference status lives in the top bar) */}
                <div className="rail-foot">
                    <div className="rel">
                        <button className="rail-profile" onClick={() => setProfileOpen((v) => !v)}>
                            <span className="avatar">{initialsOf(user!.display_name)}</span>
                            <span>
                                <span className="p-name" style={{ display: 'block' }}>{user!.display_name}</span>
                                <span className="p-role">{user!.system_roles[0] ?? '—'} · local preview</span>
                            </span>
                            <IconChevronDown size={13} style={{ marginLeft: 'auto', color: 'var(--ink-3)' }} />
                        </button>
                        {profileOpen && (
                            <div className="pop" style={{ bottom: 'calc(100% + 6px)', top: 'auto', left: 0, right: 'auto', minWidth: 220 }}>
                                <div className="pop-row"><span className="pr-main">{user!.email}</span></div>
                                <div className="pop-sep" />
                                {isAdmin && (
                                    <button className="pop-row" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', color: 'var(--ink-1)', fontSize: 'var(--fz-small)', cursor: 'pointer' }}
                                        onClick={() => { setProfileOpen(false); navigate('/admin/users'); setRailOpen(false); }}>
                                        <span className="pr-main">Manage users</span>
                                    </button>
                                )}
                                <button className="pop-row" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', color: 'var(--danger)', fontSize: 'var(--fz-small)', cursor: 'pointer' }}
                                    onClick={async () => { setProfileOpen(false); await logout(); navigate('/login'); }}>
                                    <span className="pr-main">Sign out</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <div className="app-main">
                <TopStatusBar sys={sys} title={isRoom ? 'Room' : sectionTitle(location.pathname)} />
                <div className="app-scroll" onClick={railOpen ? () => setRailOpen(false) : undefined}>{children}</div>
            </div>

            {newChat && (
                <NewChatModal
                    mode={newChat}
                    workspaces={workspaces}
                    onClose={() => setNewChat(null)}
                    onCreated={async (id) => {
                        setNewChat(null);
                        window.dispatchEvent(new CustomEvent('tolti:rooms-changed'));
                        navigate(`/rooms/${id}`);
                    }}
                />
            )}
        </div>
    );
}

function sectionTitle(path: string): string {
    if (path.startsWith('/files')) return 'Files';
    if (path.startsWith('/outputs')) return 'Outputs';
    if (path.startsWith('/activity')) return 'Room activity';
    if (path.startsWith('/rooms')) return 'Rooms';
    if (path.startsWith('/admin/users')) return 'Users';
    if (path.startsWith('/admin/models')) return 'AI Configuration';
    if (path.startsWith('/admin/policies')) return 'Routing Policies';
    if (path.startsWith('/audit')) return 'Audit';
    if (path.startsWith('/workspaces')) return 'Workspaces';
    return 'Workspace';
}
