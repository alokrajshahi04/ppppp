import type { ApiError } from '@tolti/contracts';

const BASE = ''; // vite proxy handles /api and /ws

let accessToken: string | null = null;
const listeners = new Set<(t: string | null) => void>();

export function setAccessToken(token: string | null) {
    accessToken = token;
    for (const l of listeners) l(token);
}
export function getAccessToken(): string | null { return accessToken; }
export function onTokenChange(fn: (t: string | null) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export class ApiException extends Error {
    constructor(public status: number, public detail: ApiError) {
        super(detail.message);
        this.name = 'ApiException';
    }
}

interface ReqInit extends RequestInit {
    json?: unknown;
}

async function request<T>(path: string, init: ReqInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    let body = init.body;
    if (init.json !== undefined) {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(init.json);
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers, body });
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get('content-type') ?? '';
    const data: unknown = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
        throw new ApiException(res.status, (data as ApiError) ?? { code: 'ERROR', message: res.statusText });
    }
    return data as T;
}

export const api = {
    get: <T,>(path: string) => request<T>(path),
    post: <T,>(path: string, json?: unknown) => request<T>(path, { method: 'POST', json }),
    patch: <T,>(path: string, json?: unknown) => request<T>(path, { method: 'PATCH', json }),
    del: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};
