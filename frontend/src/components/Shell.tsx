import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth, hasRole } from '../store/auth';

interface NavItem { to: string; label: string; roles?: string[]; }

const NAV_PRIMARY: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/workspaces', label: 'Workspaces' },
    { to: '/tasks', label: 'Tasks' },
];
const NAV_ADMIN: NavItem[] = [
    { to: '/admin/users', label: 'Users', roles: ['ADMIN'] },
    { to: '/admin/models', label: 'AI Models', roles: ['ADMIN'] },
    { to: '/admin/policies', label: 'Routing Policies', roles: ['ADMIN'] },
];
const NAV_GOVERNANCE: NavItem[] = [
    { to: '/audit', label: 'Audit Log', roles: ['ADMIN', 'SECURITY_APPROVER'] },
];

export function Shell({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [navOpen, setNavOpen] = useState(false);
    if (!user) return <>{children}</>;
    const roles = user.system_roles;

    const close = () => setNavOpen(false);

    const nav = (
        <div className="sidebar">
            <div className="sidebar-brand">
                <span className="mark" />
                Tolti AI
            </div>
            <div className="sidebar-section">
                <div className="sidebar-label">Work</div>
                {NAV_PRIMARY.map((i) => (
                    <NavLink key={i.to} to={i.to} onClick={close} className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
                        {i.label}
                    </NavLink>
                ))}
            </div>
            {(roles.includes('ADMIN') || roles.includes('SECURITY_APPROVER')) && (
                <div className="sidebar-section">
                    <div className="sidebar-label">Administration</div>
                    {NAV_ADMIN.filter((i) => !i.roles || hasRole(roles, ...i.roles)).map((i) => (
                        <NavLink key={i.to} to={i.to} onClick={close} className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
                            {i.label}
                        </NavLink>
                    ))}
                    {NAV_GOVERNANCE.filter((i) => !i.roles || hasRole(roles, ...i.roles)).map((i) => (
                        <NavLink key={i.to} to={i.to} onClick={close} className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
                            {i.label}
                        </NavLink>
                    ))}
                </div>
            )}
            <div className="grow" />
            <div className="sidebar-section" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s-4)' }}>
                <div className="sidebar-label">Session</div>
                <button className="sidebar-link" style={{ background: 'transparent', border: 0, textAlign: 'left', width: '100%' }} onClick={async () => { close(); await logout(); navigate('/login'); }}>
                    Sign out
                </button>
            </div>
        </div>
    );

    return (
        <div className="shell">
            {navOpen && <div className="scrim" onClick={close} />}
            <aside className={`shell-sidebar ${navOpen ? 'is-open' : ''}`}>{nav}</aside>
            <header className="shell-topbar">
                <div className="topbar">
                    <button className="hamburger" aria-label="Toggle navigation" onClick={() => setNavOpen((v) => !v)}>
                        <span /><span /><span />
                    </button>
                    <div className="topbar-title">Sovereign Workbench</div>
                    <div className="topbar-spacer" />
                    <div className="topbar-user">
                        <span>{user.display_name}</span>
                        <span className="muted">·</span>
                        <span className="muted">{roles[0] ?? '—'}</span>
                    </div>
                </div>
            </header>
            <main className="shell-main" onClick={navOpen ? close : undefined}>{children}</main>
        </div>
    );
}
