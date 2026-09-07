import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthSession, User, Workspace } from '@tolti/contracts';
import { api, getAccessToken, setAccessToken, setRefreshHandler } from '../api/client';

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<boolean>;
}

const AuthCtx = createContext<AuthState | null>(null);

const ACCESS_KEY = 'tolti.access';
const REFRESH_KEY = 'tolti.refresh';
const USER_KEY = 'tolti.user';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? (JSON.parse(raw) as User) : null;
    });
    const [accessToken, _setAccessToken] = useState<string | null>(() => localStorage.getItem(ACCESS_KEY));
    const [refreshToken, _setRefreshToken] = useState<string | null>(() => localStorage.getItem(REFRESH_KEY));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setAccessToken(accessToken);
    }, [accessToken]);

    // Let the API client recover from 401s via single-flight refresh.
    useEffect(() => {
        setRefreshHandler(async () => {
            if (!refreshToken) return false;
            try {
                const r = await api.post<{ access_token: string }>('/api/v1/auth/refresh', { refresh_token: refreshToken });
                _setAccessToken(r.access_token);
                localStorage.setItem(ACCESS_KEY, r.access_token);
                setAccessToken(r.access_token);
                return true;
            } catch {
                return false;
            }
        });
    }, [refreshToken]);

    // Validate session once at boot (client auto-refreshes on 401).
    useEffect(() => {
        (async () => {
            if (!accessToken) {
                setLoading(false);
                return;
            }
            try {
                const me = await api.get<User>('/api/v1/auth/me');
                setUser(me);
                localStorage.setItem(USER_KEY, JSON.stringify(me));
            } catch {
                clear();
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function clear() {
        _setAccessToken(null);
        _setRefreshToken(null);
        setUser(null);
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        setAccessToken(null);
     }

    async function login(email: string, password: string) {
        const session = await api.post<AuthSession>('/api/v1/auth/login', { email, password });
        _setAccessToken(session.access_token);
        _setRefreshToken(session.refresh_token);
        setUser(session.user);
        localStorage.setItem(ACCESS_KEY, session.access_token);
        localStorage.setItem(REFRESH_KEY, session.refresh_token);
        localStorage.setItem(USER_KEY, JSON.stringify(session.user));
        setAccessToken(session.access_token);
    }

    async function logout() {
        try {
            if (refreshToken) {
                await api.post('/api/v1/auth/logout', { refresh_token: refreshToken });
            }
        } finally {
            clear();
        }
    }

    async function refresh(): Promise<boolean> {
        if (!refreshToken) return false;
        try {
            const r = await api.post<{ access_token: string }>('/api/v1/auth/refresh', { refresh_token: refreshToken });
            _setAccessToken(r.access_token);
            localStorage.setItem(ACCESS_KEY, r.access_token);
            setAccessToken(r.access_token);
            return true;
        } catch {
            clear();
            return false;
        }
    }

    const value = useMemo<AuthState>(
        () => ({ user, accessToken, refreshToken, loading, login, logout, refresh }),
        [user, accessToken, refreshToken, loading],
    );

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

export function hasRole(roles: string[] | undefined, ...want: string[]): boolean {
    if (!roles) return false;
    return roles.includes('ADMIN') || want.some((r) => roles.includes(r));
}

export function initialsOf(name: string | undefined | null): string {
    if (!name) return '··';
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? parts[parts.length - 1]![0] : '';
    return (a + b).toUpperCase() || '··';
}

// ── Active workspace (shared via localStorage) ───────────────────
const WS_KEY = 'tolti.ws';

export function getActiveWorkspaceId(): string | null {
    return localStorage.getItem(WS_KEY);
}
export function setActiveWorkspaceId(id: string) {
    localStorage.setItem(WS_KEY, id);
}

export async function loadWorkspaces(): Promise<Workspace[]> {
    const list = await api.get<Workspace[]>('/api/v1/workspaces');
    const stored = getActiveWorkspaceId();
    if (list.length && (!stored || !list.some((w) => w.id === stored))) {
        // Land in the seeded default workspace when present, else the first.
        const fallback = list.find((w) => w.slug === 'default') ?? list[0]!;
        setActiveWorkspaceId(fallback.id);
    }
    return list;
}
