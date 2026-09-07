import { ZodError } from 'zod';
import type { ZodSchema } from 'zod';
import { badRequest } from './errors.js';

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
    const result = schema.safeParse(body);
    if (!result.success) throw fromZod(result.error);
    return result.data;
}

export function parseQuery<T>(schema: ZodSchema<T>, query: unknown): T {
    const result = schema.safeParse(query);
    if (!result.success) throw fromZod(result.error);
    return result.data;
}

function fromZod(err: ZodError) {
    const flat = err.flatten().fieldErrors as Record<string, string[] | undefined>;
    return badRequest('validation failed', { fields: flat });
}
