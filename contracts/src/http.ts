// HTTP envelope types — shared between backend & frontend

export interface ListResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
}

export interface HealthResponse {
    status: 'ok' | 'degraded' | 'down';
    version: string;
    services: {
        database: 'ok' | 'down';
        object_store: 'ok' | 'down';
        ai_engine: 'ok' | 'down';
    };
    uptime_seconds: number;
}

export interface FileUploadTicket {
    upload_url: string;
    storage_key: string;
    expires_at: string;
    method: 'PUT' | 'POST';
    headers?: Record<string, string>;
}
