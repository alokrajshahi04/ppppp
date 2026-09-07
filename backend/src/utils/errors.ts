import type { FastifyRequest } from 'fastify';

export class HttpError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

export const badRequest = (msg: string, details?: Record<string, unknown>) =>
    new HttpError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'unauthorized') => new HttpError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'forbidden') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'not found') => new HttpError(404, 'NOT_FOUND', msg);
export const conflict = (msg: string) => new HttpError(409, 'CONFLICT', msg);
export const internal = (msg = 'internal error', details?: Record<string, unknown>) =>
    new HttpError(500, 'INTERNAL', msg, details);

export async function ensure<T>(value: T | null | undefined, error: HttpError): Promise<T> {
    if (value === null || value === undefined) throw error;
    return value;
}

export function asUser(req: FastifyRequest | any) {
    const u = req?.user;
    if (!u) throw unauthorized();
    return u as { sub: string; email: string; system_roles: string[] };
}

export function getRequestId(req: FastifyRequest | any): string {
    return (req?.id as string) ?? 'unknown';
}

export async function replyError(reply: any, err: unknown): Promise<void> {
    if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
            details: err.details ?? null,
        });
    }
    const message = err instanceof Error ? err.message : 'internal error';
    return reply.status(500).send({ code: 'INTERNAL', message });
}
