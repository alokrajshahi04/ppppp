import { z } from 'zod';
import { asUser, forbidden, notFound } from '../utils/errors.js';
import { parseBody } from '../utils/validation.js';
import { getTask } from '../tasks/repo.js';
import { isMember } from '../workspaces/repo.js';
import { broadcastTaskEvent } from '../rooms/broadcaster.js';
import { audit } from '../governance/audit.js';
import { code, reason, retrieve, route, vision } from './client.js';
import {
    completeRun,
    createRun,
    failRun,
    getRun,
    listCitationsForRun,
    listRuns,
    recordCitation,
    startRun,
} from './repo.js';
import { indexEvidence } from './client.js';

const StartSchema = z.object({
    task_id: z.string().uuid(),
    capability: z.enum(['OCR', 'VISION', 'TEXT', 'CODE', 'EMBEDDING']).optional(),
    prompt: z.string().min(1),
    evidence_ids: z.array(z.string().uuid()).optional(),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional(),
    auto_index: z.boolean().optional(),
});

export async function aiRoutes(app: any): Promise<void> {
    app.addHook('preHandler', app.authenticate);

    app.get('/api/v1/tasks/:id/ai/runs', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const task = await getTask(id);
        if (!task) throw notFound();
        if (!(await isMember(task.workspace_id, u.sub))) throw forbidden();
        return listRuns(id);
    });

    app.post('/api/v1/tasks/:id/ai/runs', async (req: any, reply: any) => {
        const { id: taskId } = req.params as { id: string };
        const u = asUser(req);
        const task = await getTask(taskId);
        if (!task) throw notFound();
        if (!(await isMember(task.workspace_id, u.sub))) throw forbidden();
        const body = parseBody(StartSchema, req.body);

        // Optional: index any newly referenced evidence so RAG has up-to-date chunks.
        if (body.evidence_ids?.length) {
            for (const evid of body.evidence_ids) {
                await indexEvidence({
                    evidence_id: evid,
                    storage_key: '',
                    filename: '',
                    mime_type: 'application/octet-stream',
                    kind: 'OTHER',
                }).catch(() => undefined);
            }
        }

        // 1. Ask Agent Router for a decision (may be overridden by explicit capability).
        const decision = await route({
            task_id: taskId,
            capability: body.capability,
            prompt: body.prompt,
            evidence_ids: body.evidence_ids,
        });

        const run = await createRun({
            task_id: taskId,
            triggered_by: u.sub,
            capability: decision.capability as any,
            model_id: decision.model_id,
            prompt: body.prompt,
        });

        audit({
            actor_id: u.sub,
            event: 'AI_RUN_STARTED',
            task_id: taskId,
            workspace_id: task.workspace_id,
            target_id: run.id,
            payload: { capability: decision.capability, model: decision.model_id, reason: decision.reason },
        });
        broadcastTaskEvent(taskId, { type: 'ai:started', payload: { run } });

        // 2. Fire-and-forget the actual call (status updates stream back over WS).
        void runAgent({
            runId: run.id,
            taskId,
            workspaceId: task.workspace_id,
            capability: decision.capability,
            modelId: decision.model_id,
            prompt: body.prompt,
            evidenceIds: body.evidence_ids,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
        });

        return reply.status(202).send(run);
    });

    app.get('/api/v1/ai/runs/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const run = await getRun(id);
        if (!run) throw notFound();
        const task = await getTask(run.task_id);
        if (!task || !(await isMember(task.workspace_id, u.sub))) throw forbidden();
        const citations = await listCitationsForRun(id);
        return { ...run, citations };
    });

    app.delete('/api/v1/ai/runs/:id', async (req: any) => {
        const { id } = req.params as { id: string };
        const u = asUser(req);
        const run = await getRun(id);
        if (!run) throw notFound();
        if (run.triggered_by !== u.sub) throw forbidden();
        await completeRun(id, { response: run.response ?? '', status: 'CANCELLED' });
        broadcastTaskEvent(run.task_id, { type: 'ai:completed', payload: { run: { ...run, status: 'CANCELLED' } } });
        return { ok: true };
    });
}

interface RunArgs {
    runId: string;
    taskId: string;
    workspaceId: string;
    capability: string;
    modelId: string;
    prompt: string;
    evidenceIds?: string[];
    temperature?: number;
    maxTokens?: number;
}

async function runAgent(a: RunArgs): Promise<void> {
    try {
        await startRun(a.runId);
        broadcastTaskEvent(a.taskId, {
            type: 'ai:progress',
            payload: { run_id: a.runId, status: 'RUNNING' },
        });

        // Pull RAG context first if there is evidence.
        let context_chunks: Awaited<ReturnType<typeof retrieve>>['chunks'] | undefined;
        if (a.evidenceIds?.length) {
            const rag = await retrieve({ task_id: a.taskId, query: a.prompt, top_k: 8, evidence_ids: a.evidenceIds });
            context_chunks = rag.chunks;
        }

        let response: { answer: string; citations: Array<{ evidence_id: string; chunk_id: string; quote: string; confidence: number }>; model: string; token_usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };

        if (a.capability === 'CODE') {
            const r = await code({ prompt: a.prompt, model_id: a.modelId });
            response = { answer: `\`\`\`${r.language}\n${r.code}\n\`\`\`\n\n${r.explanation}`, citations: [], model: r.model };
        } else if (a.capability === 'VISION') {
            const evid = a.evidenceIds?.[0];
            if (!evid) throw new Error('vision run needs at least one evidence_id');
            const r = await vision({
                storage_key: '',
                filename: '',
                mime_type: 'image/png',
                prompt: a.prompt,
            });
            response = { answer: r.description, citations: [], model: r.model };
        } else {
            response = await reason({
                prompt: a.prompt,
                context_chunks: context_chunks?.map((c) => ({
                    content: c.content,
                    evidence_id: c.evidence_id,
                    chunk_id: c.chunk_id,
                    score: c.score,
                })),
                model_id: a.modelId,
                temperature: a.temperature,
                max_tokens: a.maxTokens,
            });
        }

        // Persist citations
        for (const c of response.citations) {
            await recordCitation({
                ai_run_id: a.runId,
                evidence_id: c.evidence_id,
                chunk_id: c.chunk_id,
                quote: c.quote,
                confidence: c.confidence,
            });
        }

        await completeRun(a.runId, {
            response: response.answer,
            status: 'SUCCEEDED',
            token_usage: response.token_usage,
        });

        const finalRun = await getRun(a.runId);
        if (finalRun) {
            broadcastTaskEvent(a.taskId, { type: 'ai:completed', payload: { run: finalRun } });
            audit({
                actor_id: a.runId, // synthetic — actually no user
                event: 'AI_RUN_COMPLETED',
                task_id: a.taskId,
                workspace_id: a.workspaceId,
                target_id: a.runId,
            });
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await failRun(a.runId, msg);
        const run = await getRun(a.runId);
        if (run) broadcastTaskEvent(a.taskId, { type: 'ai:completed', payload: { run } });
        audit({
            actor_id: null,
            event: 'AI_RUN_FAILED',
            task_id: a.taskId,
            workspace_id: a.workspaceId,
            target_id: a.runId,
            payload: { error: msg },
        });
    }
}
