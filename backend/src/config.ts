import { z } from 'zod';

const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    BACKEND_PORT: z.coerce.number().int().positive().default(3001),
    BACKEND_HOST: z.string().default('0.0.0.0'),

    DATABASE_URL: z.string().min(1),

    MINIO_ENDPOINT: z.string().min(1),
    // Host reachable from the BROWSER for presigned URLs (defaults to MINIO_ENDPOINT).
    MINIO_PUBLIC_ENDPOINT: z.string().optional(),
    MINIO_ROOT_USER: z.string().min(1),
    MINIO_ROOT_PASSWORD: z.string().min(1),
    MINIO_BUCKET: z.string().min(1),
    MINIO_PORT: z.coerce.number().int().positive().optional(),
    MINIO_SECURE: z.coerce.boolean().default(false),

    AI_ENGINE_URL: z.string().url(),

    JWT_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().default('7d'),

    LOG_LEVEL: z.string().default('info'),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
        // Print a readable error then die — fail fast on missing config.
        // eslint-disable-next-line no-console
        console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
        process.exit(1);
    }
    return parsed.data;
}

export const env: Env = loadEnv();
