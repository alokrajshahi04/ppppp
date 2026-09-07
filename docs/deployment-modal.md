# Modal.com Deployment Plan

Mapping Tolti AI onto Modal — serverless Python cloud with GPU support and per-second billing.
Status: **proposal** — decisions needed before building (see §5).

---

## 1. What Modal is (and is not)

- Serverless **Python** containers that scale to zero; you pay per second of actual use.
- First-class **GPU** support (A10, L4, T4, A100…) — the natural home for our models.
- Serves FastAPI natively (`@modal.asgi_app`), arbitrary port processes (`@modal.web_server`), and **WebSockets** (one call per connection, concurrent inputs supported).
- Auth via **proxy tokens** (`Modal-Key` / `Modal-Secret` headers) — locks our internal AI endpoint.
- Starter plan: **$30/month free credits**, 10 GPU concurrency, 200 req/s.
- ⚠️ It is a **cloud** platform. The PRD's "on-premise / air-gapped" story stays true for the local Ollama track; Modal becomes our **managed cloud track** for demos and GPU inference. Both tracks use the same OpenAI-compatible adapter, so switching is a model-config change, not a code change.

## 2. Component mapping

| Component | Today (local Docker) | On Modal | Notes |
|---|---|---|---|
| **AI engine** (FastAPI, OCR, RAG) | container | ✅ `@modal.asgi_app` — image = debian_slim + `apt tesseract poppler` + `pip install .` | Perfect fit; scale-to-zero; `scaledown_window` to trim cold starts |
| **LLM inference** | "not configured" (no local Ollama) | ✅ **This is Modal's killer use** — vLLM on GPU (`modal.Image` + vLLM recipe), weights cached in a Modal Volume | OpenAI-compatible URL → our existing `model_configs` just point at it. No agent code changes |
| Backend (Fastify/TS) | container | ⚠️ Possible via `@modal.web_server(3001)` running node, but clunky | **Recommendation:** keep on a tiny VPS/Railway/Fly for now (single node = our WS rooms work unchanged) |
| Frontend (static) | nginx | ❌ Not Modal's job | Vercel / Cloudflare Pages / same VPS |
| Postgres + pgvector | container | ❌ No managed DB on Modal | **Neon** (serverless PG, pgvector extension, free tier) or Supabase. Swap = `DATABASE_URL` env only |
| MinIO | container | ⚠️ Keep MinIO beside the backend, **or** move to S3/R2 (minio SDK is S3 — env swap only) | Modal `CloudBucketMount` possible but not required |
| WS rooms | in-process broadcaster | Single backend node keeps this working. Multi-instance later → Redis pub/sub fanout (planned refactor anyway) | Modal supports WS but rooms + scale-to-zero need sticky fanout |
| Secrets | `.env` | `modal.Secret.from_dotenv` / named secrets | JWT, SMTP, MinIO, DB URL |
| Future crons | — | `@modal.schedule` | Scheduled automations (nightly reports), OCR janitor, embedding backfills |

## 3. Phases

### M1 — AI engine on Modal (no code changes to agents) · ~1 day
- `ai-engine/modal_app.py`: one file — image def (tesseract, poppler, libgl, pip install), `@modal.asgi_app()` wrapping the existing FastAPI `app`, secrets from Modal.
- Env swaps: `DATABASE_URL` → Neon, MinIO endpoint → S3/R2 (or keep MinIO local via public tunnel for demo).
- Lock the endpoint with Modal proxy tokens; backend sends the token headers.
- **Deliverable:** OCR + automations + RAG all running on Modal, demo-able from anywhere.

### M2 — GPU model serving (the big unlock) · ~1–2 days
- vLLM app in the same repo (`ai-engine/modal_vllm.py`): serves `Qwen2.5-VL-7B` (vision+text) or split `Llama-3.1-8B` (text) + `Qwen2.5-VL` (vision); weights in a Volume (one-time download, ~16 GB).
- GPU sizing: **L4** ($0.80/h) or **A10** ($1.10/h) fit 7–8B models; T4 ($0.59/h) fits 8B quantized but no vision bf16 comfort.
- `model_configs` rows updated: `base_url = https://<workspace>--vllm-serve.modal.run/v1` — every agent (OCR/vision/text/code) immediately becomes *actually intelligent*; AI runs stop landing in FAILED.
- Embeddings stay CPU (nomic via llama.cpp endpoint or a small `@modal.function`).
- Cost control: `scaledown_window=300` → idle pays $0; first token after idle ≈ 20–40 s cold start (tune `min_containers=1` for instant demo at ~$25–55/day if left on).

### M3 — Full hosted stack · ~2–3 days
- Backend via `@modal.web_server` + node image **or** VPS; frontend on Vercel; Neon Postgres; R2 storage.
- Redis (Upstash) for WS fanout + presence if backend goes multi-instance.
- Custom domain (Team plan feature) + `AI_ENGINE_SHARED_SECRET`/JWT rotation.

## 4. Cost model (Starter plan, $30/mo free credits)

| Pattern | Cost |
|---|---|
| Idle (scale-to-zero everywhere) | **$0/h** + volume storage (1 TiB free) |
| Demo burst: 2 h GPU + CPU calls | ~$2.50–3.50 per demo |
| Always-on GPU (min_containers=1, L4) | ~$0.80/h ≈ **$580/mo** — avoid; use scale-to-zero + warm `scaledown_window` |
| CPU AI engine, 1 h/day usage | ~$0.05–0.15/day |

Realistic demo cadence (a few hours/week) fits **entirely inside the free $30/mo credits**.

## 5. Decisions needed

1. **Track:** Modal as the *cloud demo track* (on-prem story stays on Ollama) — confirm this framing is acceptable for the SIH narrative.
2. **Model choice:** single vision+text model (Qwen2.5-VL-7B, simpler) vs split text/vision (better quality, two endpoints)? My call: **Qwen2.5-VL-7B on one L4** for the demo, split later.
3. **Backend placement:** keep TS backend on the local/VPS node for M1–M2 (recommended — WS rooms stay simple), move in M3 only if we need it.
4. **Storage:** keep MinIO (simplest, zero code change) vs R2/S3 (more "cloud-native", env-only change)? My call: **MinIO beside the backend for now**.
5. **Always-on vs cold starts** for the live demo moment — if the judging demo is scheduled, I'll pre-warm with `min_containers=1` for that window.

## 6. What I'll build when you green-light

1. `ai-engine/modal_app.py` (M1) — deployable with `pip install modal && modal deploy`.
2. `ai-engine/modal_vllm.py` (M2) + a `scripts/bootstrap-models.sh` (volume download + `model_configs` update SQL).
3. `.env.modal.example` + docs update + proxy-token plumbing in `backend/src/ai/client.ts` (3 lines).
4. E2E suite re-run against the Modal URLs.
