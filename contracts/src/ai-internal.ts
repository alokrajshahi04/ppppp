import type {
    AIRunStatus,
    ModelCapability,
    EvidenceKind,
} from './enums.js';
import type { UUID } from './common.js';

// ─────────────────────────────────────────────────────────────
//  Backend → AI Engine internal API contract
//  (called over plain HTTP from the TypeScript backend)
// ─────────────────────────────────────────────────────────────

export interface EmbedRequest {
    input: string | string[];
    model_id?: string;
}

export interface EmbedResponse {
    embeddings: number[][];
    model: string;
    dimensions: number;
}

export interface OCRRequest {
    storage_key: string;
    filename: string;
    mime_type: string;
    language?: string;
}

export interface OCRResponse {
    text: string;
    pages: Array<{
        page_number: number;
        text: string;
        blocks: Array<{
            text: string;
            bbox: [number, number, number, number];
            confidence: number;
        }>;
    }>;
    model: string;
    language: string;
}

export interface VisionRequest {
    storage_key: string;
    filename: string;
    mime_type: string;
    prompt: string;
    context?: string;
}

export interface VisionResponse {
    description: string;
    findings: Array<{
        label: string;
        detail: string;
        confidence: number;
        bbox?: [number, number, number, number];
    }>;
    model: string;
}

export interface ReasoningRequest {
    prompt: string;
    system_prompt?: string;
    context_chunks?: Array<{
        content: string;
        evidence_id: UUID;
        chunk_id: UUID;
        score: number;
    }>;
    evidence_summary?: string;
    model_id?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface ReasoningResponse {
    answer: string;
    citations: Array<{
        evidence_id: UUID;
        chunk_id: UUID;
        quote: string;
        confidence: number;
    }>;
    model: string;
    token_usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface CodeRequest {
    prompt: string;
    language?: string;
    context?: string;
    model_id?: string;
}

export interface CodeResponse {
    code: string;
    explanation: string;
    language: string;
    model: string;
}

export interface RouteRequest {
    task_id: UUID;
    capability?: ModelCapability;
    input_kind?: EvidenceKind;
    prompt: string;
    evidence_ids?: UUID[];
}

export interface RouteDecision {
    capability: ModelCapability;
    model_id: string;
    reason: string;
    confidence: number;
}

export interface VerifyRequest {
    claim: string;
    citations: Array<{
        evidence_id: UUID;
        chunk_id: UUID;
        quote: string;
    }>;
}

export interface VerifyResponse {
    verdict: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'CONTRADICTED';
    confidence: number;
    reasoning: string;
}

export interface IndexEvidenceRequest {
    evidence_id: UUID;
    storage_key: string;
    filename: string;
    mime_type: string;
    ocr_text?: string;
    kind: EvidenceKind;
}

export interface IndexEvidenceResponse {
    evidence_id: UUID;
    chunks_indexed: number;
    dimensions: number;
}

export interface RetrieveRequest {
    task_id: UUID;
    query: string;
    top_k?: number;
    evidence_ids?: UUID[];
}

export interface RetrieveResponse {
    chunks: Array<{
        chunk_id: UUID;
        evidence_id: UUID;
        filename: string;
        content: string;
        score: number;
    }>;
}

// Streaming chunk format used by SSE responses
export interface StreamChunk {
    type: 'start' | 'token' | 'citation' | 'done' | 'error';
    run_id?: UUID;
    content?: string;
    citation?: ReasoningResponse['citations'][number];
    error?: string;
    status?: AIRunStatus;
}
