# Tolti AI - Presentation Kit (6-person team)

Format: **8-minute pitch + 4-minute live demo + 3-minute Q&A** (adjust per rules).
Golden rule: **nobody reads slides.** Slides carry one idea each; you carry the words.

---

## Part 1 - Slide deck (10 slides)

| # | Slide title | On the slide (max 3 lines) | Visual |
|---|---|---|---|
| 1 | **Tolti AI** | "One task. Multiple people. Multiple AI specialists. Zero data egress." | Product name + a real screenshot of one room with 3 people + 1 AI run visible |
| 2 | The problem | Industrial AI today = paste secrets into ChatGPT. No roles, no trail, no teamwork. | Two-path diagram: "today: screenshot → ChatGPT → gone" vs "Tolti: room → evidence → cited answer → audit" |
| 3 | What we built | Multiplayer AI workbench: shared rooms, private chats, specialist agents, evidence, approvals, audit. | 4-tab room screenshot (Chat / Documents / Code / Agent) |
| 4 | Multiplayer AI - the core idea | Humans AND agents in one room. Everyone sees every AI run live. Control passes person-to-person ("hand off"), not screen-share. | The two-browser moment frozen: same room, two cursors, one shared AI answer |
| 5 | Roles & governance | DRIVER / REVIEWER / WATCHER / SECURITY_APPROVER. Approvals gate AI output. Everything audited. | RBAC matrix (4 rows) + one approval card screenshot |
| 6 | Grounded answers | AI reads only your uploaded evidence. Every claim carries a citation with the source file and confidence. | One answer card with 2 citation quotes visible |
| 7 | Under the hood | React + Fastify + Postgres/pgvector + MinIO + Python agents. All in one `docker compose up`. | The architecture diagram from README (cleaned, 5 boxes) |
| 8 | The GPU story | Designed air-gapped (local Ollama). Laptop couldn't host 7–8B models → deployed vLLM on Modal rented GPUs. Same code - one config line. | Before/after: `base_url: localhost:11434` → `*.modal.run/v1` |
| 9 | Proof it works | 58/58 API checks. RBAC denials enforced. Failed runs degrade to actionable cards - never silent. | Terminal shot of the green check suite |
| 10 | What's next + ask | Multi-node WS fanout, TLS hardening, more automations. We're looking for pilot feedback. | One line + team names/roles |

Design note for whoever makes the deck: dark background matching the app (#121212), one accent color (#90CAF9), no clip-art, no gradients. Screenshots of the actual product are the visuals.

---

## Part 2 - Who says what (script)

### BEAT 0 · Hook - Presenter A (0:00–0:45)

> "Good morning. Quick question, sir - when a maintenance engineer at a plant needs AI help with a confidential failure report, what are their options today? Paste it into a public chatbot. That's it. The secret leaves the company, there's no record, and if two engineers and a safety officer need to work on it together - that happens in WhatsApp screenshots.
>
> We built the missing product. **Tolti AI** - a multiplayer agentic AI workbench where one task, multiple trusted people, and multiple specialist AI agents share one room, one evidence trail, and one audit log. And not a single byte has to leave the deployment."

### BEAT 1 · The problem, made sharp - Presenter A (0:45–1:30)

> "Three failures in today's industrial AI use. **Confidentiality** - public chatbots ingest your data. **Accountability** - when an AI answer influences a safety decision, there is no trail of who asked what, on which evidence, and who signed it off. **Teamwork** - AI tools are single-player; real industrial work is done by a driver, a reviewer, and a security approver.
>
> Slide two shows it plainly: today it's screenshot-to-ChatGPT-and-gone. With Tolti it's room, evidence, cited answer, sign-off, audit."

### BEAT 2 · What we built - Presenter B (1:30–2:15)

> "So here's the room. Every task in Tolti is a room - like this maintenance investigation. Inside it: **Chat** for the team, **Documents** for evidence, **Code** for the code-specialist agent, and an **Agent** tab for automations, approvals and run history.
>
> The composer at the bottom is one box with a switch: 'Team' sends to your colleagues, 'Ask AI' routes to the right specialist model. Same room, one timeline - you can see your teammate's message and the AI's answer in the same thread."

### BEAT 3 · Multiplayer AI - Presenter B (2:15–3:00)

> "The word that matters is **multiplayer**. Two things are multiplayer here.
>
> One - **the humans**: presence, live messages, and - watch this later - 'hand off', which transfers driving control of the room from one person to another, live. No screen sharing.
>
> Two - **the AI**: it's not one chatbot, it's a team of specialist agents - OCR, vision, text, code, embeddings - and an **Agent Router** that decides which specialist answers each request. Every run appears in the room's timeline for everyone, in real time, over WebSockets."

### BEAT 4 · Roles & governance - Presenter B (3:00–3:30)

> "Because this is for industrial work, governance is built in, not bolted on. Five roles. A **driver** owns the room; a **security approver** must sign off before gated AI output leaves; a **watcher** can see but not act. Every approval request, decision, AI run and file access lands in an immutable **audit log**. The API enforces this - the UI only shows what your role is allowed to do."

### BEAT 5 · LIVE DEMO part 1 - Coder A (3:30–5:15)

*(Coder A drives, Presenter B narrates or stays quiet. Have two browsers pre-arranged side by side, both logged in - e.g. driver@ and reviewer@. Room pre-loaded with one evidence PDF.)*

> **Coder A:** "Let me show it live. Two browsers - I'm the driver on the left, my teammate is the reviewer on the right, same room."
> *(Type a message on the left → it appears on the right instantly.)* "Live over WebSockets - no refresh."
> *(Drag-drop a PDF into Documents.)* "Evidence upload goes **directly to our on-prem MinIO** via presigned URLs - the file never passes through the API server. OCR and indexing run locally."
> *(Ask AI: 'Summarise the observed fault from the bearing report and list open questions.' → answer streams in.)*
> "Now the important part - **citations**." *(Expand citations.)* "Every claim maps to a quote in the uploaded document, with a confidence score. The answer is grounded in *our* evidence - not the model's imagination."

### BEAT 6 · LIVE DEMO part 2 - Coder B (5:15–6:30)

> **Coder B:** "I'll take the specialist side. Code tab - the composer automatically targets the code model now." *(Ask it to write a small function; show the answer.)*
> "Agent tab - these **automations** do real work on the room. 'Export report' builds a document from this room's evidence and messages. 'Email summary' drafts the email. And they also trigger from plain chat - I can literally type 'export a report'."
> "Governance, live: I hit **Request approval**. *(Switch to security@ browser or show the pending state.)* A reviewer without approver rights sees the request but the Approve/Reject buttons simply aren't there - the API refuses them anyway. The security approver approves, and it's in the audit trail."

### BEAT 7 · The GPU story - Presenter A (6:30–7:15)

> "Sir, one honest engineering note we're proud of. The product is designed to run **air-gapped** - the default model config points at a local Ollama/vLLM endpoint. But a 7–8 billion parameter model needs GPU memory a laptop doesn't have. So for this demo we deployed **vLLM servers on rented GPUs on Modal** - scale-to-zero, per-second billing, OpenAI-compatible endpoints.
>
> The point: our agents speak the OpenAI adapter, so switching from on-prem to Modal GPUs was **one config line** - `base_url`. The architecture is deployment-agnostic. What you saw in the demo is our code; where the model runs is a dropdown."

### BEAT 8 · Testing & quality - Tester (7:15–8:00)

> **Tester:** "Reliability, sir, in three numbers.
> **58 out of 58** - our automated end-to-end API suite: auth, refresh-token rejection, role denials, real MinIO upload/download, the full AI-run lifecycle, approval gating, audit. All green.
> **Zero silent failures** - when a model endpoint is down, the run fails into an actionable card with a retry, and the room's data is never lost. We demo that state deliberately.
> **5 roles tested** - every RBAC denial in the matrix is asserted by the suite, not just by clicking around."

### BEAT 9 · UI/UX - UX (8:00–8:40)

> **UX:** "And I own the 'does it feel right' part. Three deliberate calls. One - **role-aware UI**: a watcher never sees a button the API would reject; you can't get into a state where the product lies to you. Two - **one composer, one switch**: instead of three different chat boxes, there's a single input whose target is always visible. Three - **calm dark theme with strict hierarchy**: status is colour-coded everywhere the same way, so in a high-stakes workflow the eye learns the language once. Every screen you've seen was reviewed against that checklist."

### BEAT 10 · Close - Presenter B (8:40–9:00)

> "Tolti AI works today - you saw it. Multiplayer rooms, grounded answers with citations, roles, approvals, audit, and models on rented GPUs with an air-gapped fallback. Industrial AI that a safety officer can actually sign. Thank you - we're happy to take questions."

---

## Part 3 - Demo choreography cheat-sheet

**Pre-demo checklist (Tester owns this, 10 min before):**
- [ ] Both browsers logged in (left: `admin@tolti.ai`, right: `reviewer@tolti.ai`), same room open, Agent tab pre-opened on right? (No - start everyone on Chat tab.)
- [ ] One evidence PDF already in the room (so the AI demo is instant, not waiting on OCR).
- [ ] GPU warm: fire one throwaway AI run 5 min before presenting (Modal cold start is 20–40s).
- [ ] Backup: screen recording of the full demo on the laptop, in case venue WiFi dies.
- [ ] `make up` state verified: `docker compose ps` all healthy.

**The handoff moment (steal this):** during Coder A's part, on the LEFT browser click **Hand off → teammate**, and point at the RIGHT browser: "notice the driving strip just flipped to their name on both screens - control moved, nobody shared a screen." This is the single most memorable 5 seconds of the demo; rehearse it.

**If a model call fails live:** don't apologise - narrate it: "This is the failure state I mentioned - see, the run becomes an actionable card with retry, the evidence is untouched." Then retry once. (Tester: keep one known-good cached run screenshot as plan C.)

---

## Part 4 - Q&A prep (likely professor questions)

1. **"You used a cloud GPU - isn't your whole pitch on-premise?"**
   → The product ships with local endpoints as the default; Modal is our demo track because a laptop can't host 7–8B models. Same OpenAI adapter, one config line to switch. The architecture is the claim; the GPU rental is scaffolding.
2. **"How is this different from ChatGPT Teams / Slack + a bot?"**
   → Roles and signing authority. A bot in Slack can't enforce 'only a security approver releases this output', ground every answer in approved evidence with citations, or produce a signed audit trail. Also self-hosted: the data never reaches any vendor.
3. **"What stops the LLM from hallucinating?"**
   → Retrieval-grounded answers (pgvector over the room's evidence) + a verification step that attaches quotes and confidence per citation. Answers that can't be grounded come back saying so.
4. **"Multiplayer - what does the server do when two people act at once?"**
   → The backend is the single writer: all actions are API calls with JWT + role checks; the WS layer only broadcasts committed state, so everyone converges to the same timeline.
5. **"Scale?"**
   → Single node today (one Postgres, one API). The design keeps the seams: WS fanout can move to Redis pub/sub, models are already a separate service, storage is S3-compatible. We deliberately didn't distribute a hackathon build we can't load-test.
6. **"Why Postgres with pgvector instead of a vector DB?"**
   → One system, one backup, one auth boundary - and evidence chunks belong to the same relational world as rooms and approvals. At our scale (thousands of chunks) pgvector's ANN is more than enough.
7. **"How do you handle auth?"**
   → JWT access + refresh, bcrypt hashes, role checks at the route layer; the AI engine sits behind a shared-secret internal API - the browser can never call it directly.
8. **"What was hardest?"**
   → Honest answer: model deployment. Local laptop VRAM was the wall; moving to Modal vLLM taught us where the real boundary is - config, not code. Second: making failure states useful instead of silent.
9. **"Cost?"**
   → Scale-to-zero: idle ≈ $0. A 2-hour demo burst is a few dollars, inside Modal's free tier. The on-prem track costs the price of the hardware it runs on.
10. **"What's next?"**
   → Multi-node WS fanout, TLS + secrets hardening, more automations (scheduled reports), and a pilot with one plant's maintenance team.

---

## Part 5 - Role summary (who owns what)

| Person | Owns |
|---|---|
| Presenter A | Hook, problem, GPU story. Slides 1–2, 8. |
| Presenter B | Product tour, multiplayer, governance, close. Slides 3–5, 7, 10. |
| Coder A | Live demo part 1: multiplayer chat, evidence upload, cited AI answer. Slide 6. |
| Coder B | Live demo part 2: code agent, automations, approvals + audit. Slide 9 (with Tester). |
| Tester | The 45-check story, RBAC denials, failure-state demo, **pre-demo checklist owner**, backup recording. |
| UX | Design walkthrough, role-aware UI reasoning, theme/hierarchy story. Slide-deck design owner. |
