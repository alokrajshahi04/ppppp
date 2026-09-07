import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, hasRole } from '../store/auth';

export function RequireAuth({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const loc = useLocation();
    if (loading) return <div className="empty">Loading…</div>;
    if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
    return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (!hasRole(user.system_roles, ...roles)) {
        return <div className="page"><div className="banner banner-error">You don't have permission to view this page.</div></div>;
    }
    return <>{children}</>;
}
