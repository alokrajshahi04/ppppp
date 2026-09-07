import type { AIRun, AIRunStatus, ModelCapability } from '@tolti/contracts';
import { query } from '../db/pool.js';

export async function listRuns(taskId: string): Promise<AIRun[]> {
    const { rows } = await query<AIRun>(`SELECT * FROM ai_runs WHERE task_id = $1 ORDER BY created_at DESC`, [taskId]);
    return rows;
}

export async function getRun(id: string): Promise<AIRun | null> {
    const { rows } = await query<AIRun>(`SELECT * FROM ai_runs WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

export async function createRun(input: {
    task_id: string;
    triggered_by: string;
    capability: ModelCapability;
    model_id: string;
    prompt: string;
}): Promise<AIRun> {
    const { rows } = await query<AIRun>(
        `INSERT INTO ai_runs (task_id, triggered_by, capability, model_id, prompt, status)
         VALUES ($1, $2, $3::model_capability, $4, $5, 'QUEUED') RETURNING *`,
        [input.task_id, input.triggered_by, input.capability, input.model_id, input.prompt],
    );
    return rows[0]!;
}

export async function startRun(id: string): Promise<void> {
    await query(`UPDATE ai_runs SET status = 'RUNNING', started_at = NOW() WHERE id = $1`, [id]);
}

export async function completeRun(
    id: string,
    patch: { response: string; status: AIRunStatus; token_usage?: Record<string, number>; error?: string | null },
): Promise<void> {
    await query(
        `UPDATE ai_runs SET
            response      = $2,
            status        = $3::ai_run_status,
            error         = $4,
            token_usage   = $5::jsonb,
            completed_at  = NOW()
          WHERE id = $1`,
        [id, patch.response, patch.status, patch.error ?? null, JSON.stringify(patch.token_usage ?? {})],
    );
}

export async function failRun(id: string, err: string): Promise<void> {
    await query(
        `UPDATE ai_runs SET status = 'FAILED', error = $2, completed_at = NOW() WHERE id = $1`,
        [id, err],
    );
}

export async function recordCitation(input: {
    ai_run_id: string;
    evidence_id: string;
    chunk_id: string | null;
    quote: string;
    confidence: number | null;
}): Promise<void> {
    await query(
        `INSERT INTO citations (ai_run_id, evidence_id, chunk_id, quote, confidence)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.ai_run_id, input.evidence_id, input.chunk_id, input.quote, input.confidence],
    );
}

export async function listCitationsForRun(runId: string) {
    const { rows } = await query(
        `SELECT id, ai_run_id, evidence_id, chunk_id, quote, confidence, created_at
           FROM citations WHERE ai_run_id = $1 ORDER BY created_at ASC`,
        [runId],
    );
    return rows;
}
