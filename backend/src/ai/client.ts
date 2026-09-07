// Thin client for the Python AI engine. Keeps all network details in one place.

import { env } from '../config.js';

const BASE = env.AI_ENGINE_URL.replace(/\/$/, '');

async function call<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`ai-engine ${path} failed ${res.status}: ${detail}`);
    }
    return (await res.json()) as T;
}

export interface EmbedInput { input: string | string[]; model_id?: string }
export interface EmbedResp { embeddings: number[][]; model: string; dimensions: number }
export const embed = (req: EmbedInput) => call<EmbedResp>('/v1/embed', req);

export interface OCRReq { storage_key: string; filename: string; mime_type: string; language?: string }
export interface OCRResp { text: string; pages: any[]; model: string; language: string }
export const ocr = (req: OCRReq) => call<OCRResp>('/v1/ocr', req);

export interface VisionReq { storage_key: string; filename: string; mime_type: string; prompt: string; context?: string }
export interface VisionResp { description: string; findings: any[]; model: string }
export const vision = (req: VisionReq) => call<VisionResp>('/v1/vision', req);

export interface ReasonReq {
    prompt: string;
    system_prompt?: string;
    context_chunks?: Array<{ content: string; evidence_id: string; chunk_id: string; score: number }>;
    evidence_summary?: string;
    model_id?: string;
    temperature?: number;
    max_tokens?: number;
}
export interface ReasonResp {
    answer: string;
    citations: Array<{ evidence_id: string; chunk_id: string; quote: string; confidence: number }>;
    model: string;
    token_usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}
export const reason = (req: ReasonReq) => call<ReasonResp>('/v1/reason', req);

export interface CodeReq { prompt: string; language?: string; context?: string; model_id?: string }
export interface CodeResp { code: string; explanation: string; language: string; model: string }
export const code = (req: CodeReq) => call<CodeResp>('/v1/code', req);

export interface RouteReq { task_id?: string; capability?: string; input_kind?: string; prompt: string; evidence_ids?: string[] }
export interface RouteResp { capability: string; model_id: string; reason: string; confidence: number; params?: Record<string, unknown> | null }
export const route = (req: RouteReq) => call<RouteResp>('/v1/route', req);

export interface IndexReq {
    evidence_id: string;
    storage_key: string;
    filename: string;
    mime_type: string;
    ocr_text?: string;
    kind: string;
}
export interface IndexResp { evidence_id: string; chunks_indexed: number; dimensions: number }
export const indexEvidence = (req: IndexReq) => call<IndexResp>('/v1/index/evidence', req);

export interface RetrieveReq { task_id?: string; query: string; top_k?: number; evidence_ids?: string[] }
export interface RetrieveResp {
    chunks: Array<{ chunk_id: string; evidence_id: string; filename: string; content: string; score: number }>;
}
export const retrieve = (req: RetrieveReq) => call<RetrieveResp>('/v1/retrieve', req);

// ── Automations (agentic actions) ────────────────────────────
export interface AutomationParamDef { name: string; label: string; required: boolean; placeholder: string }
export interface AutomationDef {
    id: string;
    title: string;
    description: string;
    keywords: string[];
    params: AutomationParamDef[];
}
export const listAutomations = () =>
    fetch(`${BASE}/v1/automations`).then(async (r) => {
        if (!r.ok) throw new Error(`automations list failed: ${r.status}`);
        return (await r.json()) as AutomationDef[];
    });

export interface AutomationExecReq { task_id: string; params?: Record<string, unknown> }
export interface AutomationExecResp { ok: boolean; summary?: string; error?: string; hint?: string; details?: Record<string, unknown> }
export const executeAutomation = (id: string, req: AutomationExecReq) =>
    call<AutomationExecResp>(`/v1/automations/${id}/execute`, req);

export async function pingAi(): Promise<boolean> {
    try {
        const r = await fetch(`${BASE}/health`);
        return r.ok;
    } catch {
        return false;
    }
}
