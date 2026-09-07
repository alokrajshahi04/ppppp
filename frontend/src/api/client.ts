import type { ApiError } from '@tolti/contracts';

const BASE = ''; // vite dev proxy / nginx handle /api and /ws

let accessToken: string | null = null;
const tokenListeners = new Set<(t: string | null) => void>();

export function setAccessToken(token: string | null) {
    accessToken = token;
    for (const l of tokenListeners) l(token);
}
export function getAccessToken(): string | null { return accessToken; }

// Registered by the auth store — lets the client recover from expired
// access tokens without a circular import. Single-flight, retry once.
let refreshHandler: (() => Promise<boolean>) | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setRefreshHandler(fn: () => Promise<boolean>) {
    refreshHandler = fn;
}

async function tryRefresh(): Promise<boolean> {
    if (!refreshHandler) return false;
    refreshInFlight ??= refreshHandler().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
}

export class ApiException extends Error {
    constructor(public status: number, public detail: ApiError) {
        super(detail.message);
        this.name = 'ApiException';
    }
}

interface ReqInit extends RequestInit {
    json?: unknown;
    _retried?: boolean;
}

async function raw(path: string, init: ReqInit): Promise<Response> {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    let body = init.body;
    if (init.json !== undefined) {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(init.json);
    }
    return fetch(`${BASE}${path}`, { ...init, headers, body });
}

async function request<T>(path: string, init: ReqInit = {}): Promise<T> {
    const authEndpoint = path.startsWith('/api/v1/auth/login') || path.startsWith('/api/v1/auth/refresh');
    let res = await raw(path, init);

    // Expired access token → refresh once, then retry the original request.
    if (res.status === 401 && !authEndpoint && !init._retried) {
        const ok = await tryRefresh();
        if (ok) {
            res = await raw(path, { ...init, _retried: true });
        }
    }

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
    // For presigned uploads/downloads — never add auth headers or JSON content-type.
    putRaw: (url: string, body: Blob | File, contentType: string) =>
        fetch(url, { method: 'PUT', body, headers: { 'Content-Type': contentType } }),
};

// ── Automations (agentic actions, registry lives in the AI engine) ──
export interface AutomationParamDef {
    name: string;
    label: string;
    required: boolean;
    placeholder: string;
}
export interface AutomationDef {
    id: string;
    title: string;
    description: string;
    keywords: string[];
    params: AutomationParamDef[];
}
