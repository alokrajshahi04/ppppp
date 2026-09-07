import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import websocket from '@fastify/websocket';

import { env } from './config.js';
import { pingDatabase, pool } from './db/pool.js';
import { registerJwt } from './auth/jwt.js';
import { authRoutes } from './auth/routes.js';
import { userRoutes } from './auth/user_routes.js';
import { workspaceRoutes } from './workspaces/routes.js';
import { evidenceRoutes, taskRoutes } from './tasks/routes.js';
import { messageRoutes } from './messages/routes.js';
import { aiRoutes } from './ai/routes.js';
import { approvalRoutes } from './approvals/routes.js';
import { governanceRoutes } from './governance/routes.js';
import { internalRoutes } from './internal/routes.js';
import { websocketRoutes } from './rooms/websocket.js';
import { pingAi } from './ai/client.js';
import { pingStorage } from './evidence/storage.js';
import { HttpError } from './utils/errors.js';
import type { HealthResponse } from '@tolti/contracts';
import './types-augment.js';

export async function buildServer() {
    const app = Fastify({
        logger: {
            level: env.LOG_LEVEL,
            transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
        },
        bodyLimit: 10 * 1024 * 1024,
        trustProxy: true,
    });

    await app.register(cors, {
        origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
        credentials: true,
    });
    await app.register(sensible);
    await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } });
    await app.register(websocket);
    await registerJwt(app);

    app.decorate('authenticate', async (req: any, reply: any) => {
        try {
            await req.jwtVerify();
        } catch {
            return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'invalid or missing token' });
        }
    });

    app.setErrorHandler((err: any, req: any, reply: any) => {
        if (err instanceof HttpError) {
            return reply.status(err.statusCode).send({
                code: err.code,
                message: err.message,
                details: err.details ?? null,
            });
        }
        if (err && typeof err === 'object' && 'validation' in err && err.validation) {
            return reply.status(400).send({
                code: 'BAD_REQUEST',
                message: 'validation failed',
                details: err.validation,
            });
        }
        req.log.error(err);
        return reply.status(500).send({ code: 'INTERNAL', message: 'internal error' });
    });

    // ── Health ─────────────────────────────────────────────
    app.get('/health', async () => {
        const [db, obj, ai] = await Promise.all([pingDatabase(), pingStorage(), pingAi()]);
        const status: HealthResponse['status'] =
            db && obj && ai ? 'ok' : !db || !obj ? 'down' : 'degraded';
        return {
            status,
            version: '0.1.0',
            services: {
                database: db ? 'ok' : 'down',
                object_store: obj ? 'ok' : 'down',
                ai_engine: ai ? 'ok' : 'down',
            },
            uptime_seconds: Math.round(process.uptime()),
        } satisfies HealthResponse;
    });

    // ── Routes ─────────────────────────────────────────────
    // Each group registers inside its own encapsulated scope so its
    // preHandler hook cannot leak onto sibling routes or /health.
    await app.register(async (scope) => authRoutes(scope));          // public + per-route auth
    await app.register(async (scope) => userRoutes(scope));          // JWT group
    await app.register(async (scope) => workspaceRoutes(scope));     // JWT group
    await app.register(async (scope) => taskRoutes(scope));          // JWT group
    await app.register(async (scope) => evidenceRoutes(scope));      // JWT group
    await app.register(async (scope) => messageRoutes(scope));       // JWT group
    await app.register(async (scope) => aiRoutes(scope));            // JWT group
    await app.register(async (scope) => approvalRoutes(scope));      // JWT group
    await app.register(async (scope) => governanceRoutes(scope));    // JWT group
    await app.register(async (scope) => internalRoutes(scope));      // shared-secret group
    await app.register(async (scope) => websocketRoutes(scope));     // query-token group

    return app;
}

async function main() {
    const app = await buildServer();
    try {
        await app.listen({ host: env.BACKEND_HOST, port: env.BACKEND_PORT });
        app.log.info(`backend listening on :${env.BACKEND_PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }

    const shutdown = async (sig: string) => {
        app.log.info(`${sig} received — shutting down`);
        try {
            await app.close();
            await pool.end();
        } finally {
            process.exit(0);
        }
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Auto-run if invoked directly (not imported by tests).
const isMain =
    import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1]?.endsWith('server.ts') ||
    process.argv[1]?.endsWith('server.js');
if (isMain) void main();
