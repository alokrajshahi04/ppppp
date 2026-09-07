import type {
    AIRunStatus,
    ModelCapability,
    MessageKind,
    PresenceStatus,
    AuditInfo,
    UUID,
} from './common.js';

export interface AIRun {
    id: UUID;
    task_id: UUID;
    triggered_by: UUID;
    capability: ModelCapability;
    model_id: string;
    prompt: string;
    response: string | null;
    status: AIRunStatus;
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
    token_usage: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    } | null;
    citations?: Citation[];
    created_at: string;
}

export interface Citation {
    id: UUID;
    ai_run_id: UUID;
    evidence_id: UUID;
    chunk_id: UUID | null;
    quote: string;
    confidence: number | null;
}

export interface StartAIRunRequest {
    task_id: UUID;
    capability?: ModelCapability;
    prompt: string;
    evidence_ids?: UUID[];
    temperature?: number;
    max_tokens?: number;
}

export interface PostMessageRequest {
    task_id: UUID;
    content: string;
    kind?: MessageKind;
    attachments?: unknown[];
    metadata?: Record<string, unknown>;
}

export interface ModelConfig extends AuditInfo {
    id: UUID;
    capability: ModelCapability;
    name: string;
    provider: string;
    base_url: string;
    api_key: string | null;
    model_id: string;
    is_default: boolean;
    settings: Record<string, unknown>;
}

export interface CreateModelConfigRequest {
    capability: ModelCapability;
    name: string;
    provider: string;
    base_url: string;
    api_key?: string;
    model_id: string;
    is_default?: boolean;
    settings?: Record<string, unknown>;
}

export interface UpdateModelConfigRequest {
    name?: string;
    base_url?: string;
    api_key?: string;
    model_id?: string;
    is_default?: boolean;
    settings?: Record<string, unknown>;
}

export interface RoutingPolicy extends AuditInfo {
    id: UUID;
    name: string;
    is_active: boolean;
    rules: RoutingRule[];
}

export interface RoutingRule {
    when?: Record<string, unknown>;
    default?: boolean;
    route_to: ModelCapability;
    model_id?: string;
}

export interface CreateRoutingPolicyRequest {
    name: string;
    is_active?: boolean;
    rules: RoutingRule[];
}

export interface UpdateRoutingPolicyRequest {
    is_active?: boolean;
    rules?: RoutingRule[];
}
