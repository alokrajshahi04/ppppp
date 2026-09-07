import type { User } from '@tolti/contracts';
import { query } from '../db/pool.js';

interface UserRow {
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    system_roles: string[];
}

const USER_SELECT = `
    SELECT
        u.id,
        u.email,
        u.display_name,
        u.password_hash,
        u.is_active,
        u.created_at,
        u.updated_at,
        COALESCE(
            (SELECT array_agg(role::text) FROM user_system_roles WHERE user_id = u.id),
            ARRAY[]::text[]
        ) AS system_roles
    FROM users u
`;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await query<UserRow>(`${USER_SELECT} WHERE u.email = $1 LIMIT 1`, [email]);
    return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
    const { rows } = await query<UserRow>(`${USER_SELECT} WHERE u.id = $1 LIMIT 1`, [id]);
    if (!rows[0]) return null;
    return rowToUser(rows[0]);
}

export async function listUsers(): Promise<User[]> {
    const { rows } = await query<UserRow>(`${USER_SELECT} ORDER BY u.created_at DESC`);
    return rows.map(rowToUser);
}

export async function createUser(input: {
    email: string;
    display_name: string;
    password_hash: string;
    system_roles: string[];
}): Promise<User> {
    const { rows } = await query<UserRow>(
        `INSERT INTO users (email, display_name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name, password_hash, is_active, created_at, updated_at`,
        [input.email, input.display_name, input.password_hash],
    );
    const user = rows[0]!;
    for (const role of input.system_roles) {
        await query(`INSERT INTO user_system_roles (user_id, role) VALUES ($1, $2::user_role)`, [
            user.id,
            role,
        ]);
    }
    const fresh = await findUserById(user.id);
    return fresh!;
}

export async function updateUser(
    id: string,
    patch: { display_name?: string; is_active?: boolean; system_roles?: string[] },
): Promise<User | null> {
    if (patch.display_name !== undefined || patch.is_active !== undefined) {
        await query(
            `UPDATE users
                SET display_name = COALESCE($2, display_name),
                    is_active    = COALESCE($3, is_active)
              WHERE id = $1`,
            [id, patch.display_name ?? null, patch.is_active ?? null],
        );
    }
    if (patch.system_roles) {
        await query(`DELETE FROM user_system_roles WHERE user_id = $1`, [id]);
        for (const role of patch.system_roles) {
            await query(
                `INSERT INTO user_system_roles (user_id, role) VALUES ($1, $2::user_role)`,
                [id, role],
            );
        }
    }
    return findUserById(id);
}

export async function changePassword(id: string, password_hash: string): Promise<void> {
    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, password_hash]);
}

function rowToUser(row: UserRow): User {
    return {
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        system_roles: row.system_roles as User['system_roles'],
    };
}
