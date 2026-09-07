# Tolti AI · AI Engine (internal service)

This is the Python AI engine that the TypeScript backend calls over HTTP.

It owns:

- The **Agent Router** that decides which specialist handles an incoming task.
- The **model-provider abstraction** — every model speaks the same OpenAI-compatible interface, so a single config swap retargets the whole system (Ollama, vLLM, LM Studio, llama.cpp, etc.).
- The **specialist agents**:
  - `ocr` — extract text from PDFs / images.
  - `vision` — describe diagrams, photos, scanned documents.
  - `text` — answer / reason over evidence + retrieved chunks.
  - `code` — code intelligence + assistance.
- The **RAG pipeline** — chunking, embedding, pgvector retrieval.
- The **verification layer** — citation generation + claim support checks.
- **Session / run logging** for replay and auditability.

## Layout

```
ai-engine/
├── app/
│   ├── main.py            # FastAPI entrypoint
│   ├── config.py          # Settings (env-driven)
│   ├── deps.py            # Shared FastAPI dependencies
│   ├── routers/           # HTTP routes (one file per capability)
│   ├── agents/            # Specialist agent implementations
│   ├── models/            # Model provider adapters
│   ├── rag/               # Chunking / embedding / retrieval
│   ├── verification/      # Citation + claim verification
│   ├── storage/           # MinIO + DB clients
│   ├── router/            # Agent Router (decision logic)
│   ├── schemas/           # Pydantic request / response models
│   └── logging.py         # Structured logging
├── tests/
├── pyproject.toml
└── Dockerfile
```

## Endpoints (consumed by backend)

| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | Liveness |
| POST | `/v1/embed` | Generate embeddings |
| POST | `/v1/ocr` | OCR a stored document |
| POST | `/v1/vision` | Analyse an image / diagram |
| POST | `/v1/reason` | Reasoning with RAG context (SSE stream supported) |
| POST | `/v1/code` | Code intelligence |
| POST | `/v1/route` | Ask Agent Router which model should handle this task |
| POST | `/v1/verify` | Verify a claim against its citations |
| POST | `/v1/index/evidence` | Chunk + embed + index an evidence file |
| POST | `/v1/retrieve` | Top-k retrieval for a query |

## Configuration

All settings come from environment variables (see `.env.example`). The
TypeScript backend is the only intended consumer — these endpoints are not
exposed to the browser.
