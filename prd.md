# TOLTI AI — PRODUCT REQUIREMENTS DOCUMENT

**Product:** Tolti AI  
**Problem Statement:** SIH26117 — Sovereign On-Premise Agentic AI Workbench using Open-Weight Multimodal LLMs for Confidential Industrial Work  
**Theme:** Smart Automation  
**Product Type:** Sovereign, on-premise, air-gapped, multiplayer agentic AI workbench  
**Document Version:** 1.0  
**Status:** Build Specification  
**Primary Goal:** Build a real, functional product rather than a demo-only prototype.

---

# 1. PRODUCT VISION

Tolti AI is a sovereign, multiplayer AI workspace for confidential industrial work.

It enables engineers, maintenance teams, reviewers, security personnel and management to collaboratively work with local AI models on confidential documents, PDFs, scanned documents, engineering diagrams, images and code without requiring confidential data to leave the local environment.

The system combines:

- Multiplayer AI workspaces
- Local multimodal AI
- Agentic task execution
- Intelligent model routing
- Document intelligence
- OCR
- Vision understanding
- Code assistance
- Evidence-backed answers
- Human-in-the-loop approval
- Role-based collaboration
- Task handoff
- Complete auditability
- Session replay
- LAN-only / air-gapped operation

The core product philosophy is:

> One task. Multiple trusted people. Multiple specialist AI capabilities. One shared source of truth. Zero required data egress.

---

# 2. PRODUCT PRINCIPLES

## 2.1 Local-first

The system must operate on-premise and must not require external cloud services for core functionality.

## 2.2 Model-agnostic

The application must not be tightly coupled to one AI model.

Models must be replaceable through a model-provider abstraction and an OpenAI-compatible interface.

## 2.3 Specialist models

A single model must not be responsible for every modality.

At minimum the system must support separate:

- OCR model
- Vision model
- Text/reasoning model
- Code model

The Agent Router decides which model or agent should process a task.

## 2.4 Human governed

The AI must not automatically become the final authority for sensitive industrial conclusions or actions.

Approvals, evidence gates and role permissions must be enforced by the platform.

## 2.5 Evidence-backed

Important AI claims should be linked to their originating local evidence.

## 2.6 Multiplayer by design

Collaboration is a core product capability, not an additional chat feature.

Multiple users must be able to work on the same task and see synchronized state.

## 2.7 Real product, not demo flow

Every major feature used in the primary workflow must have a real implementation.

Do not create fake buttons, simulated AI responses, static collaboration states or placeholder workflows for core functionality.

---

# 3. PRIMARY USER PERSONAS

## 3.1 Engineer

Uses Tolti AI to investigate technical issues, analyze documents, inspect diagrams, ask questions and generate technical notes.

Primary capabilities:

- Create tasks
- Upload evidence
- Ask AI
- Review findings
- Collaborate
- Add context
- Request reports
- Hand off tasks

## 3.2 Maintenance Reviewer

Reviews AI findings, provides field context, challenges conclusions and approves or rejects outputs.

## 3.3 Watcher

Observes a live task and its activity without controlling the task.

## 3.4 Security Approver

Reviews sensitive outputs and approves actions or final reports where required by policy.

## 3.5 Administrator

Manages:

- Users
- Roles
- Workspaces
- AI models
- Model endpoints
- Policies
- Storage
- System configuration
- Audit logs

---

# 4. USER ROLES

## 4.1 ADMIN

Full system administration.

Permissions:

- Manage users
- Manage roles
- Manage workspaces
- Configure models
- Configure policies
- View audit logs
- Configure storage
- Configure system settings
- View system health
- Manage agents

## 4.2 DRIVER

The primary task owner.

Can:

- Create tasks
- Start AI runs
- Upload evidence
- Ask AI
- Steer AI
- Invite collaborators
- Request approval
- Hand off a task
- Generate reports
- Perform permitted actions

## 4.3 REVIEWER

Can:

- View task context
- View evidence
- Inspect AI outputs
- Comment
- Challenge findings
- Add context
- Request revisions
- Approve/reject outputs where permitted

## 4.4 WATCHER

Can:

- View task state
- View conversation
- View evidence
- View AI activity
- View collaboration activity

Cannot:

- Modify task state
- Approve actions
- Execute privileged actions
- Change routing policy

## 4.5 SECURITY_APPROVER

Can:

- Review sensitive outputs
- Approve/reject gated actions
- Review evidence
- Review audit history

---

# 5. TECHNICAL ARCHITECTURE

## 5.1 Required technology separation

### Frontend

Use:

- React
- TypeScript
- Modern CSS
- Component-based architecture

### Application Backend

Use TypeScript for:

- Authentication
- Authorization
- User management
- Workspace management
- Tasks
- Rooms
- Multiplayer collaboration
- WebSockets
- Messages
- Document metadata
- Approvals
- Audit logs
- Notifications
- System configuration
- API gateway
- Application business logic

### AI Engine

Use Python primarily for:

- AI inference
- Agent orchestration
- Agent Router
- OCR
- Vision processing
- Document intelligence
- Retrieval
- Embeddings
- Code intelligence
- AI verification
- Specialist agents
- Model adapters

### AI API

The Python AI engine must expose an internal API that the TypeScript backend can call.

### Database

Use PostgreSQL.

Use pgvector or equivalent local vector storage for semantic retrieval.

### File/object storage

Use local object storage such as MinIO or a filesystem-backed abstraction.

The application must not assume a cloud object store.

---

# 6. HIGH-LEVEL SYSTEM ARCHITECTURE

```text
                         USER BROWSER
                              |
                              |
                     React + TypeScript
                              |
                    HTTPS + WebSocket
                              |
                              v
                  TypeScript Application Backend
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
      Auth                Multiplayer             API
      RBAC                    Rooms              Services
        |                     |                     |
        +---------------------+---------------------+
                              |
                       Internal AI API
                              |
                              v
                       Python AI Engine
                              |
                  +-----------+-----------+
                  |                       |
                  v                       v
             Agent Router           Agent Orchestrator
                  |
        +---------+---------+---------+---------+
        |                   |                   |
        v                   v                   v
     OCR Model          Vision Model       Text/Code Models
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
                     Retrieval / RAG
                            |
                            v
                       Verification
                            |
                            v
                     Final AI Output
                            |
                +-----------+-----------+
                |                       |
                v                       v
             Citation               Approval
                |                       |
                +-----------+-----------+
                            |
                            v
                       Audit Event