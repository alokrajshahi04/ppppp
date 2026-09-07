import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { RequireAuth, RequireRole } from './components/RequireAuth';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { TaskListPage, NewTaskPage } from './pages/Tasks';
import { TaskDetailPage } from './pages/TaskDetail';
import { AuditPage } from './pages/Audit';
import { UsersAdminPage } from './pages/UsersAdmin';
import { ModelsAdminPage } from './pages/ModelsAdmin';
import { WorkspacesPage } from './pages/Workspaces';

export function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
                <RequireAuth>
                    <Shell>
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/workspaces" element={<WorkspacesPage />} />
                            <Route path="/tasks" element={<TaskListPage />} />
                            <Route path="/tasks/new" element={<NewTaskPage />} />
                            <Route path="/tasks/:id" element={<TaskDetailPage />} />
                            <Route path="/audit" element={<RequireRole roles={['ADMIN', 'SECURITY_APPROVER']}><AuditPage /></RequireRole>} />
                            <Route path="/admin/users" element={<RequireRole roles={['ADMIN']}><UsersAdminPage /></RequireRole>} />
                            <Route path="/admin/models" element={<RequireRole roles={['ADMIN']}><ModelsAdminPage /></RequireRole>} />
                            <Route path="/admin/policies" element={<RequireRole roles={['ADMIN']}><ModelsAdminPage /></RequireRole>} />
                            <Route path="*" element={<div className="page"><div className="empty">Page not found.</div></div>} />
                        </Routes>
                    </Shell>
                </RequireAuth>
            } />
        </Routes>
    );
}
