import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config.js';

export interface JwtPayload {
    sub: string;        // user id
    email: string;
    system_roles: string[];
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: JwtPayload;
        user: JwtPayload;
    }
}

export type AuthenticatedRequest = FastifyRequest & { user: JwtPayload };

export async function authPreHandler(
    req: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    try {
        await req.jwtVerify();
    } catch {
        return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'invalid or missing token' });
    }
}

export async function registerJwt(app: any): Promise<void> {
    await app.register(import('@fastify/jwt'), {
        secret: env.JWT_SECRET,
        sign: { expiresIn: env.JWT_EXPIRES_IN },
    });
}

export function signAccessToken(app: any, payload: JwtPayload): string {
    return app.jwt.sign(payload);
}
