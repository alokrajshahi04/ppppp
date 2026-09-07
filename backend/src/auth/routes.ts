import { z } from 'zod';
import type { AuthSession, LoginRequest, RefreshRequest, UserRole } from '@tolti/contracts';
import {
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    changePassword,
} from '../users/repo.js';
import { hashPassword, verifyPassword } from './password.js';
import { signAccessToken, type JwtPayload } from './jwt.js';
import { parseBody } from '../utils/validation.js';
import { asUser, badRequest, conflict, notFound, unauthorized } from '../utils/errors.js';
import { audit } from '../governance/audit.js';
import { query } from '../db/pool.js';

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
}) satisfies z.ZodType<LoginRequest>;

const RefreshSchema = z.object({
    refresh_token: z.string().min(10),
}) satisfies z.ZodType<RefreshRequest>;

const ChangePasswordSchema = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8),
});

export async function authRoutes(app: any): Promise<void> {
    app.post('/api/v1/auth/login', async (req: any, reply: any) => {
        const body = parseBody(LoginSchema, req.body);
        const user = await findUserByEmail(body.email);
        if (!user) throw unauthorized('invalid credentials');
        if (!user.is_active) throw unauthorized('account disabled');
        const ok = await verifyPassword(body.password, user.password_hash);
        if (!ok) throw unauthorized('invalid credentials');

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            system_roles: user.system_roles,
        };
        const access_token = await reply.jwtSign(payload, { expiresIn: '1h' });
        const refresh_token = await issueRefreshToken(user.id, req);

        audit({
            actor_id: user.id,
            event: 'USER_LOGIN',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] ?? null,
        });

        const session: AuthSession = {
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                is_active: user.is_active,
                created_at: user.created_at,
                updated_at: user.updated_at,
                system_roles: user.system_roles as UserRole[],
            },
            access_token,
            refresh_token,
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
        return reply.send(session);
    });

    app.post('/api/v1/auth/refresh', async (req: any, reply: any) => {
        const body = parseBody(RefreshSchema, req.body);
        const { rows } = await query<{
            user_id: string;
            expires_at: string;
            revoked_at: string | null;
        }>(
            `SELECT user_id, expires_at, revoked_at FROM sessions WHERE refresh_token = $1`,
            [body.refresh_token],
        );
        const row = rows[0];
        if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
            throw unauthorized('refresh token invalid or expired');
        }
        const user = await findUserById(row.user_id);
        if (!user) throw unauthorized();
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            system_roles: user.system_roles,
        };
        const access_token = await reply.jwtSign(payload, { expiresIn: '1h' });
        return reply.send({
            access_token,
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
    });

    app.post('/api/v1/auth/logout', async (req: any) => {
        const body = parseBody(RefreshSchema, req.body ?? {});
        await query(
            `UPDATE sessions SET revoked_at = NOW() WHERE refresh_token = $1`,
            [body.refresh_token],
        );
        return { ok: true };
    });

    app.get('/api/v1/auth/me', { preHandler: app.authenticate }, async (req: any) => {
        const u = asUser(req);
        const user = await findUserById(u.sub);
        if (!user) throw notFound('user not found');
        return user;
    });

    app.post('/api/v1/auth/change-password', { preHandler: app.authenticate }, async (req: any) => {
        const u = asUser(req);
        const body = parseBody(ChangePasswordSchema, req.body);
        const user = await findUserByEmail(u.email);
        if (!user) throw notFound();
        const ok = await verifyPassword(body.current_password, user.password_hash);
        if (!ok) throw badRequest('current password incorrect');
        const newHash = await hashPassword(body.new_password);
        await changePassword(user.id, newHash);
        audit({ actor_id: user.id, event: 'USER_UPDATED' });
        return { ok: true };
    });
}

async function issueRefreshToken(userId: string, req: any): Promise<string> {
    const token = `${userId}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
        `INSERT INTO sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
            userId,
            token,
            req.ip ?? null,
            req.headers?.['user-agent'] ?? null,
            expires.toISOString(),
        ],
    );
    return token;
}
