import pg from 'pg';
import { env } from '../config.js';

export const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
});

export type QueryResult<T extends pg.QueryResultRow = pg.QueryResultRow> = pg.QueryResult<T>;

// One query helper so every repo can share the same connection lifecycle.
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: ReadonlyArray<unknown> = [],
): Promise<pg.QueryResult<T>> {
    return pool.query<T>(text, params as unknown[]);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function pingDatabase(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}
