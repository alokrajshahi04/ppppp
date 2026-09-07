// Fastify type augmentations for Tolti backend.

import 'fastify';

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (req: any, reply: any) => Promise<void>;
    }
}
