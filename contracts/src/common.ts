// Tolti AI · shared common types
export * from './enums.js';

export type UUID = string;
export type ISO8601 = string;

export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

export interface AuditInfo {
    created_at: ISO8601;
    updated_at: ISO8601;
}
