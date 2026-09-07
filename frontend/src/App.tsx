import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { Evidence, Task, Workspace } from '@tolti/contracts';
import { api } from './api/client';
import { Shell } from './components/Shell';
import { RequireAuth, RequireRole } from './components/RequireAuth';
import { loadWorkspaces } from './store/auth';
import { LoginPage } from './pages/Login';
import { RoomsPage } from './pages/Rooms';
import { RoomPage } from './pages/Room';
import { FilesPage } from './pages/Files';
import { OutputsPage } from './pages/Outputs';
import { ActivityPage } from './pages/Activity';
import { AuditPage } from './pages/Audit';
import { UsersAdminPage } from './pages/UsersAdmin';
import { ModelsAdminPage } from './pages/ModelsAdmin';
import { WorkspacesPage } from './pages/Workspaces';

/** Home: drop the user into their most recent room, or the rooms index. */
function Home() {
    const navigate = useNavigate();
    const [done, setDone] = useState(false);
    const decide = useCallback(async () => {
        try {
            const r = await api.get<{ items: Task[] }>('/api/v1/tasks?page_size=1');
            navigate(r.items[0] ? `/rooms/${r.items[0].id}` : '/rooms', { replace: true });
        } catch {
            navigate('/rooms', { replace: true });
        } finally {
            setDone(true);
        }
    }, [navigate]);
    useEffect(() => { void decide(); }, [decide]);
    return <div className="page"><div className="empty"><span className="spinner" /></div>{done && null}</div>;
}

/** Shared room/workspace data for the aggregate pages — scoped to the active workspace. */
function useRoomData() {
    const [rooms, setRooms] = useState<Task[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [wsTick, setWsTick] = useState(0);
    const reload = useCallback(async () => {
        try {
            const ws = await loadWorkspaces();
            setWorkspaces(ws);
            const active = localStorage.getItem('tolti.ws');
            const qs = new URLSearchParams({ page_size: '50' });
            if (active) qs.set('workspace_id', active);
            const r = await api.get<{ items: Task[] }>(`/api/v1/tasks?${qs}`);
            setRooms(r.items);
        } catch { /* not signed in yet */ }
    }, [wsTick]);
    useEffect(() => { void reload(); }, [reload]);
    useEffect(() => {
        const wsChanged: EventListener = () => setWsTick((t) => t + 1);
        window.addEventListener('tolti:ws-changed', wsChanged);
        return () => window.removeEventListener('tolti:ws-changed', wsChanged);
    }, []);
    const evidenceOf = useCallback(async (roomId: string) => {
        return api.get<Evidence[]>(`/api/v1/tasks/${roomId}/evidence`);
    }, []);
    return { rooms, workspaces, evidenceOf, reload };
}

export function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
                <RequireAuth>
                    <Shell>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/rooms" element={<RoomsPage />} />
                            <Route path="/rooms/:id" element={<RoomPage />} />
                            <Route path="/files" element={<FilesRoute />} />
                            <Route path="/outputs" element={<OutputsRoute />} />
                            <Route path="/activity" element={<ActivityRoute />} />
                            <Route path="/workspaces" element={<WorkspacesPage />} />
                            <Route path="/audit" element={<RequireRole roles={['ADMIN', 'SECURITY_APPROVER']}><AuditPage /></RequireRole>} />
                            <Route path="/admin/users" element={<RequireRole roles={['ADMIN']}><UsersAdminPage /></RequireRole>} />
                            <Route path="/admin/models" element={<RequireRole roles={['ADMIN']}><ModelsAdminPage /></RequireRole>} />
                            <Route path="/admin/policies" element={<RequireRole roles={['ADMIN']}><ModelsAdminPage /></RequireRole>} />
                            {/* Legacy paths keep working */}
                            <Route path="/tasks" element={<Navigate to="/rooms" replace />} />
                            <Route path="/tasks/new" element={<Navigate to="/rooms?new=1" replace />} />
                            <Route path="/tasks/:id" element={<LegacyTaskRedirect />} />
                            <Route path="/dashboard" element={<Navigate to="/" replace />} />
                            <Route path="*" element={<div className="page"><div className="empty">This page does not exist. <br /><br /><a className="btn" href="/">Back to workspace</a></div></div>} />
                        </Routes>
                    </Shell>
                </RequireAuth>
            } />
        </Routes>
    );
}

function LegacyTaskRedirect() {
    const { id } = { id: window.location.pathname.split('/').pop() };
    return <Navigate to={`/rooms/${id}`} replace />;
}

function FilesRoute() {
    const { rooms, evidenceOf } = useRoomData();
    const navigate = useNavigateSafe();
    return <FilesPage rooms={rooms} evidenceOf={evidenceOf} open={(id) => navigate(`/rooms/${id}`)} />;
}
function OutputsRoute() {
    const { rooms } = useRoomData();
    return <OutputsPage rooms={rooms} />;
}
function ActivityRoute() {
    const { rooms } = useRoomData();
    return <ActivityPage rooms={rooms} />;
}

function useNavigateSafe() {
    return useNavigate();
}
