// Machine-to-machine endpoints called by the Python AI engine.
// NOT part of the JWT scope — authenticated with a shared secret header:
//   X-Internal-Token: <AI_ENGINE_SHARED_SECRET>

import type { FastifyInstance } from 'fastify';
import { forbidden } from '../utils/errors.js';
import { getEvidence, getTask, setEvidenceOcrText } from '../tasks/repo.js';
import { indexEvidence } from '../ai/client.js';

function assertInternalToken(req: any): void {
    const token = req.headers['x-internal-token'];
    if (!process.env.AI_ENGINE_SHARED_SECRET || token !== process.env.AI_ENGINE_SHARED_SECRET) {
        throw forbidden('invalid internal token');
    }
}

export async function internalRoutes(app: FastifyInstance): Promise<void> {
    // Called by the AI engine after it finishes OCR on an evidence file.
    app.post('/internal/evidence/:id/ocr', async (req: any, reply: any) => {
        assertInternalToken(req);
        const { id } = req.params as { id: string };
        const body = req.body as { text: string };
        if (!body?.text) return reply.status(400).send({ code: 'BAD_REQUEST', message: 'text required' });

        await setEvidenceOcrText(id, body.text);

        // Fire-and-forget: refresh the RAG index for this evidence.
        const evidence = await getEvidence(id);
        if (evidence) {
            const task = await getTask(evidence.task_id);
            if (task) {
                indexEvidence({
                    evidence_id: id,
                    storage_key: evidence.storage_key,
                    filename: evidence.filename,
                    mime_type: evidence.mime_type,
                    ocr_text: body.text,
                    kind: evidence.kind,
                }).catch(() => undefined);
            }
        }
        return reply.send({ ok: true });
    });
}
