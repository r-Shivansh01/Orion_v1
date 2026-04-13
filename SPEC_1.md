# Orion — Full Project Specification

> **For Gemini CLI / Agentic AI Development**
> This document is the single source of truth for the Orion project. All decisions are final unless explicitly marked as Phase 2. Follow this spec precisely when generating code, configs, and infrastructure files.

> **On the name:** Orion's Belt is three stars in a line — Alnitak, Alnilam, and Mintaka — each distinct, but part of one coordinated system. The three agents in this platform are named after them. The constellation hunts; so does this platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Decisions & Justifications](#2-architecture-decisions--justifications)
3. [Full Tech Stack](#3-full-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Service Specifications](#5-service-specifications)
6. [Data Models & Database Schema](#6-data-models--database-schema)
7. [Message Queue Contract](#7-message-queue-contract)
8. [API Contract (REST)](#8-api-contract-rest)
9. [WebSocket Protocol](#9-websocket-protocol)
10. [Agent Logic & CrewAI Design](#10-agent-logic--crewai-design)
11. [DevOps & Infrastructure](#11-devops--infrastructure)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [Directory Structure](#14-directory-structure)
15. [Environment Variables](#15-environment-variables)
16. [Development Setup (GitHub Codespaces)](#16-development-setup-github-codespaces)
17. [Build Order & Milestones](#17-build-order--milestones)
18. [Known Constraints & Phase 2 Upgrades](#18-known-constraints--phase-2-upgrades)
19. [Optimizations & Unique Features](#19-optimizations--unique-features)

---

## 1. Project Overview

**Orion** is an event-driven, microservices-based platform that orchestrates a swarm of specialized LLM agents to complete complex software tasks autonomously.

Instead of a single chatbot, a user submits a high-level goal (e.g., *"Write a Python script to scrape a website and save results to a CSV"*). The platform spins up three specialized AI agents — **Alnitak (Planner)**, **Alnilam (Coder)**, and **Mintaka (QA Reviewer)** — named after the three stars of Orion's Belt. They communicate asynchronously via a message broker to complete the task end-to-end.

**What makes it a top-tier DevOps + AI portfolio project:**
- Fully containerized microservices via Docker & Docker Compose
- Asynchronous, event-driven architecture using RabbitMQ
- Real-time observability via WebSockets streamed to the frontend
- Visual node-graph UI showing live agent activity (React Flow)
- Automated CI/CD: push to GitHub → build → deploy, zero manual steps
- Production monitoring with Prometheus + Grafana
- GitHub Student account resources used efficiently throughout

**Primary use case (demo-able):** A developer submits a coding task. They watch the three-agent pipeline — Alnitak, Alnilam, Mintaka — light up on a visual canvas, see streaming logs of agent "thoughts," and download the final reviewed code artifact.

---

## 2. Architecture Decisions & Justifications

All decisions are final for Phase 1. Do not deviate from these.

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Agent Framework | **CrewAI** | LangChain, AutoGen | CrewAI is purpose-built for role-based multi-agent systems. Each agent maps directly to a CrewAI `Agent` with a defined `role`, `goal`, and `backstory`. Natural fit. |
| Message Broker | **RabbitMQ** | Redis Pub/Sub | RabbitMQ provides durable queues — messages persist even if a consumer pod is down. Redis Pub/Sub is ephemeral; messages are lost if no subscriber is active at publish time. |
| Autoscaling | **Docker Compose `--scale`** (Phase 1) | Kubernetes HPA, KEDA | K8s HPA scales on CPU, which never spikes for I/O-bound LLM agents. KEDA (queue-depth scaling) is correct but requires a full K8s cluster. Docker Compose `--scale` is simpler, demoes the concept, and is documented as a Phase 2 K8s/KEDA upgrade. |
| Orchestration | **Docker Compose** | Kubernetes (EKS/GKE/AKS) | K8s is expensive ($70+/month) and over-engineered for a portfolio project with no real traffic. Docker Compose on a VM achieves the same microservices architecture at zero cost using GitHub Student Pack DigitalOcean credits. |
| Container Registry | **GHCR (GitHub Container Registry)** | Docker Hub, AWS ECR | Free with GitHub Student account. Native integration with GitHub Actions. No separate account needed. |
| Database | **PostgreSQL + Prisma** | MongoDB, MySQL | Prisma gives type-safe queries with migration support. PostgreSQL handles relational job state cleanly. |
| LLM Provider | **Google Gemini 1.5 Flash** | OpenAI GPT-4, Anthropic Claude | Gemini Flash has a generous free tier (1500 requests/day). No credit card required with Google AI Studio. Perfect for a student project. |
| WebSocket server | **Dedicated Notification Service** | WebSockets in API Gateway | API Gateway must stay stateless HTTP-only for scalability. A dedicated Python FastAPI service handles persistent WebSocket connections and bridges RabbitMQ events to the frontend. |
| Deployment target | **DigitalOcean Droplet** (via GitHub Student Pack) | Vercel, Railway, Render | DO gives a raw VM with full Docker support. GitHub Student Pack includes $200 DO credit. Backend microservices need raw Docker Compose, not PaaS platforms. |
| Frontend deployment | **Vercel** | DO Droplet, Netlify | Next.js + Vercel is zero-config, free, and the natural pair. Frontend stays separate from the backend infra. |
| Auth mechanism | **JWT (JSON Web Tokens)** | OAuth, Sessions | Lightweight, stateless. API Gateway validates JWT on every request via middleware. No session storage needed across pods. |
| Retry logic | **Max 3 retries + DLQ** | Unlimited retries | Prevents infinite QA rejection loops. After 3 Coder failures, the job moves to `Failed` state and the message is routed to a Dead Letter Queue for inspection. |

---

## 3. Full Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Graph UI:** React Flow (visual agent node canvas)
- **Real-time:** Native WebSocket API (no Socket.io)
- **HTTP Client:** Axios
- **Deployment:** Vercel (free tier)

### API Gateway
- **Runtime:** Node.js 20
- **Framework:** Express.js
- **Auth:** `jsonwebtoken` + `bcryptjs`
- **Message Publishing:** `amqplib` (RabbitMQ client)
- **DB Client:** Prisma Client
- **Port:** 4000

### Notification Service
- **Runtime:** Python 3.11
- **Framework:** FastAPI with `uvicorn`
- **WebSocket:** FastAPI native WebSocket support
- **RabbitMQ client:** `aio-pika` (async)
- **Port:** 4001

### Agent Workers (3 separate services)
- **Runtime:** Python 3.11
- **Agent Framework:** CrewAI 0.28+
- **LLM:** Google Gemini 1.5 Flash via `langchain-google-genai`
- **RabbitMQ client:** `aio-pika`
- **Services:** `planner-agent` (Alnitak), `coder-agent` (Alnilam), `qa-agent` (Mintaka)

### Infrastructure
- **Containerization:** Docker + Docker Compose v2
- **Message Broker:** RabbitMQ 3.13 (with Management UI on port 15672)
- **Database:** PostgreSQL 16
- **Reverse Proxy:** Nginx (production only)
- **CI/CD:** GitHub Actions
- **Container Registry:** GHCR (ghcr.io)
- **Deployment VM:** DigitalOcean Droplet (Ubuntu 22.04, 2vCPU/4GB RAM)

### Monitoring
- **Metrics:** Prometheus
- **Dashboards:** Grafana
- **App metrics:** `prom-client` (Node.js), `prometheus-fastapi-instrumentator` (Python)

---

## 4. System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Frontend)                        │
│                    Next.js Dashboard                            │
│         React Flow Canvas │ Terminal Logs │ Download            │
└────────────┬──────────────────────────────────┬────────────────┘
             │ HTTPS REST                        │ WebSocket
             ▼                                   ▼
┌────────────────────┐              ┌──────────────────────────┐
│   API Gateway      │              │   Notification Service   │
│   (Node/Express)   │              │   (Python FastAPI)       │
│   Port: 4000       │              │   Port: 4001             │
│   - Auth (JWT)     │              │   - WS connection mgr    │
│   - Job creation   │              │   - RabbitMQ subscriber  │
│   - Prisma ORM     │              │   - Pushes events to UI  │
└──────┬─────────────┘              └──────────┬───────────────┘
       │                                        │
       │ Publish                                │ Subscribe
       ▼                                        │ task.completed
┌─────────────────────────────────────────────────────────────┐
│                    RabbitMQ Message Broker                   │
│                                                              │
│  Queues:                                                     │
│  task.created ──► planner-agent                             │
│  plan.completed ──► coder-agent                             │
│  code.drafted ──► qa-agent                                  │
│  code.rejected ──► coder-agent  (with retry_count check)    │
│  task.completed ──► notification-service                    │
│  task.failed ──► DLQ (dead letter queue)                    │
└──────────────────────────────────────────────────────────────┘
       │             │              │
       ▼             ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Alnitak  │  │ Alnilam  │  │ Mintaka  │
│ Planner  │  │  Coder   │  │   QA     │
│ (CrewAI) │  │ (CrewAI) │  │ (CrewAI) │
│ Python   │  │ Python   │  │ Python   │
└──────────┘  └──────────┘  └──────────┘
       │             │              │
       └─────────────┴──────────────┘
                     │ All agents read/write
                     ▼
            ┌─────────────────┐
            │   PostgreSQL    │
            │   Database      │
            └─────────────────┘

       ┌─────────────┐    ┌─────────────┐
       │ Prometheus  │◄───│  Grafana    │
       │  (metrics)  │    │ (dashboard) │
       └─────────────┘    └─────────────┘
```

### Request Lifecycle (Happy Path)

```
1.  User submits prompt → POST /api/tasks → API Gateway
2.  Gateway validates JWT, creates Job in PostgreSQL (status: PENDING)
3.  Gateway publishes {job_id, prompt} to task.created queue
4.  Planner Agent picks up task.created
5.  Planner calls Gemini → generates JSON plan
6.  Planner updates DB (status: PLANNING, plan_json: {...})
7.  Planner publishes {job_id, plan} to plan.completed queue
8.  Coder Agent picks up plan.completed
9.  Coder calls Gemini → writes code from the plan
10. Coder updates DB (status: CODING, code_draft: "...")
11. Coder publishes {job_id, code} to code.drafted queue
12. QA Agent picks up code.drafted
13. QA calls Gemini → reviews code for bugs/security issues
    ├── PASS: Updates DB (status: COMPLETED, final_output: "...")
    │         Publishes to task.completed → Notification Service → WebSocket → Frontend
    └── FAIL (retry_count < 3): Updates DB (retry_count++)
              Publishes {job_id, code, feedback} to code.rejected → Coder Agent
              FAIL (retry_count >= 3): Updates DB (status: FAILED)
              Publishes to task.failed → DLQ → Notification Service → Frontend
```

---

## 5. Service Specifications

### 5.1 API Gateway (`api-gateway`)

**Responsibility:** Single entry point for all frontend HTTP requests. Handles authentication, job creation, and publishing events to RabbitMQ.

**Must NOT:** Maintain WebSocket connections. Must NOT call agent services directly. Must NOT perform LLM operations.

**Key behaviors:**
- Validates JWT on all protected routes via Express middleware
- On `POST /api/tasks`: Creates job in DB, publishes to `task.created`, returns `job_id`
- On `GET /api/tasks/:id`: Returns current job status from DB
- Connects to RabbitMQ on startup; retries connection with exponential backoff if RabbitMQ is not ready
- Exposes `/metrics` endpoint for Prometheus scraping

**Dependencies:** PostgreSQL, RabbitMQ

---

### 5.2 Notification Service (`notification-service`)

**Responsibility:** Bridge between RabbitMQ events and frontend WebSocket clients. Maintains a registry of active WebSocket connections keyed by `job_id`.

**Must NOT:** Write to the database. Must NOT publish to RabbitMQ. Must NOT call LLMs.

**Key behaviors:**
- On WebSocket connect: Client sends `{ "subscribe": "<job_id>" }`. Service stores `connection_map[job_id] = websocket`
- Subscribes to RabbitMQ queues: `task.completed`, `task.failed`, and a `agent.progress` queue (published by agents for intermediate log streaming)
- On receiving a RabbitMQ message for `job_id`: Looks up `connection_map[job_id]` and sends the payload over WebSocket
- If client disconnects: Removes from `connection_map`
- Handles multiple clients watching the same job (broadcasts to all)

**WebSocket message types sent to client:**
```json
{ "type": "AGENT_STATUS", "agent": "planner", "status": "working", "timestamp": "..." }
{ "type": "AGENT_LOG",    "agent": "coder",   "message": "Writing function parse_csv()...", "timestamp": "..." }
{ "type": "TASK_COMPLETE", "job_id": "...",   "output": "...", "timestamp": "..." }
{ "type": "TASK_FAILED",   "job_id": "...",   "reason": "...", "timestamp": "..." }
```

---

### 5.3 Planner Agent — *Alnitak* (`planner-agent`)

**Responsibility:** Receives a raw user prompt. Uses Gemini to decompose it into a structured JSON execution plan. Publishes the plan for the Coder.

**Subscribes to:** `task.created`
**Publishes to:** `plan.completed`, `agent.progress`

**CrewAI Agent definition:**
```
Role: "Senior Software Architect"
Goal: "Decompose the user's task into a clear, step-by-step JSON execution plan that a developer can follow precisely."
Backstory: "You are an expert at breaking down complex software requirements into atomic, ordered development steps."
LLM: Gemini 1.5 Flash
```

**Output schema (published to `plan.completed`):**
```json
{
  "job_id": "uuid",
  "plan": {
    "objective": "string",
    "language": "python | javascript | bash | other",
    "steps": [
      { "step": 1, "action": "string", "details": "string" },
      { "step": 2, "action": "string", "details": "string" }
    ],
    "expected_output": "string"
  }
}
```

**DB updates:**
- On start: `UPDATE jobs SET status = 'PLANNING' WHERE id = job_id`
- On complete: `UPDATE jobs SET status = 'CODING', plan_json = {...} WHERE id = job_id`

---

### 5.4 Coder Agent — *Alnilam* (`coder-agent`)

**Responsibility:** Receives the structured plan from Planner. Uses Gemini to write the actual code. Also handles re-coding requests from QA rejections.

**Subscribes to:** `plan.completed`, `code.rejected`
**Publishes to:** `code.drafted`, `agent.progress`

**CrewAI Agent definition:**
```
Role: "Expert Software Developer"
Goal: "Write clean, working, well-commented code that precisely implements the given plan. Fix issues identified by the QA reviewer when code is rejected."
Backstory: "You are a senior developer who writes production-quality code. When your code is rejected, you carefully read the feedback and fix every issue."
LLM: Gemini 1.5 Flash
```

**Retry logic:**
- When receiving from `code.rejected`, check `retry_count` field in the message
- If `retry_count >= 3`: Do NOT process. Publish to `task.failed`. Update DB status to `FAILED`.
- If `retry_count < 3`: Re-code using `qa_feedback` included in the message. Publish to `code.drafted` with `retry_count + 1`.

**Output schema (published to `code.drafted`):**
```json
{
  "job_id": "uuid",
  "code": "string (the full code as a raw string)",
  "language": "python | javascript | bash | other",
  "retry_count": 0
}
```

**DB updates:**
- On start: `UPDATE jobs SET status = 'CODING' WHERE id = job_id`
- On complete: `UPDATE jobs SET code_draft = '...', retry_count = N WHERE id = job_id`

---

### 5.5 QA Agent — *Mintaka* (`qa-agent`)

**Responsibility:** Reviews the code produced by the Coder. Checks for bugs, logic errors, security issues, and whether the code matches the original plan. Approves or rejects using a numeric severity score.

**Subscribes to:** `code.drafted`
**Publishes to:** `task.completed` (on pass) OR `code.rejected` (on fail)

**CrewAI Agent definition:**
```
Role: "Senior QA Engineer & Security Reviewer"
Goal: "Rigorously review code for correctness, security vulnerabilities, and adherence to the original plan. Return a severity-scored JSON decision. Approve only code that is production-ready."
Backstory: "You are a meticulous code reviewer who catches bugs others miss. You provide specific, actionable feedback when rejecting code, and assign a severity score that reflects how serious the issues are."
LLM: Gemini 1.5 Flash
```

**Severity-based decision logic (added: QA Severity Scoring):**
- QA now returns a `severity` integer from 1–10 alongside the decision.
- `severity 1–3` → Auto-PASS with a warning logged. Code is accepted despite minor style issues.
- `severity 4–7` → FAIL. Coder retries with specific feedback.
- `severity 8–10` → Hard FAIL. Coder retries and the severity is stored in the DB for DLQ inspection.
- On PASS (any severity): Publish to `task.completed`. Update DB: `status = COMPLETED`, `final_output = code`, `qa_severity = N`.
- On FAIL: Publish to `code.rejected` with `qa_feedback` and `severity`. Coder manages `retry_count`.

**Decision logic:**
- If code passes review: Publish to `task.completed`. Update DB: `status = COMPLETED`, `final_output = code`.
- If code fails review: Publish to `code.rejected` with specific `qa_feedback` string. Do NOT update `retry_count` here — Coder manages that.

**Output schema on rejection (published to `code.rejected`):**
```json
{
  "job_id": "uuid",
  "code": "string (the rejected code)",
  "language": "string",
  "retry_count": 1,
  "severity": 7,
  "qa_feedback": "Line 12: SQL injection vulnerability. Variable is directly interpolated into query. Use parameterized queries instead."
}
```

**DB updates:**
- On pass: `UPDATE jobs SET status = 'COMPLETED', final_output = '...', qa_severity = N, completed_at = NOW() WHERE id = job_id`
- On fail: `UPDATE jobs SET status = 'REVIEWING', qa_severity = N WHERE id = job_id` (Coder will change it back to CODING on retry)

---

## 6. Data Models & Database Schema

### Jobs Table
```sql
CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  prompt        TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  -- Status values: PENDING | PLANNING | CODING | REVIEWING | COMPLETED | FAILED
  plan_json     JSONB,
  code_draft    TEXT,
  final_output  TEXT,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  qa_severity   INTEGER,                   -- QA severity score 1–10 (added: QA Severity Scoring)
  event_log     JSONB NOT NULL DEFAULT '[]', -- Full ordered event array for replay (added: Agent Replay Mode)
  qa_feedback   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
```

### Users Table
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Prisma Schema (`api-gateway/prisma/schema.prisma`)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  jobs         Job[]

  @@map("users")
}

model Job {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  prompt      String
  status      String    @default("PENDING")
  planJson    Json?     @map("plan_json")
  codeDraft   String?   @map("code_draft")
  finalOutput String?   @map("final_output")
  retryCount  Int       @default(0) @map("retry_count")
  qaFeedback  String?   @map("qa_feedback")
  qaSeverity  Int?      @map("qa_severity")       // QA severity score 1–10 (added: QA Severity Scoring)
  eventLog    Json      @default("[]") @map("event_log") // Full event array for replay (added: Agent Replay Mode)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  completedAt DateTime? @map("completed_at")
  user        User      @relation(fields: [userId], references: [id])

  @@map("jobs")
}
```

---

## 7. Message Queue Contract

### RabbitMQ Configuration
- **Exchange type:** Direct
- **Exchange name:** `orion`
- **All queues:** Durable = `true` (messages survive broker restart)
- **Message persistence:** `deliveryMode: 2` (persistent)
- **Acknowledgement:** Manual ACK only — agents ACK after DB update, not on receive
- **Dead Letter Queue:** `task.dlq` — receives messages from `task.failed`
- **Prefetch:** 1 (each worker processes one message at a time)

### Queue Definitions

| Queue Name | Producer | Consumer | Purpose |
|---|---|---|---|
| `task.created` | API Gateway | Planner Agent | New job submitted |
| `plan.completed` | Planner Agent | Coder Agent | Plan ready for coding |
| `code.drafted` | Coder Agent | QA Agent | Code ready for review |
| `code.rejected` | QA Agent | Coder Agent | Code failed review |
| `task.completed` | QA Agent | Notification Service | Job finished successfully |
| `task.failed` | Coder Agent | Notification Service | Job failed after max retries |
| `agent.progress` | All Agents | Notification Service | Streaming log updates |
| `task.dlq` | RabbitMQ (DLQ) | — | Dead letter — failed messages for inspection |

### Standard Message Envelope
Every message published to any queue must follow this envelope:
```json
{
  "job_id": "uuid-v4",
  "event": "task.created | plan.completed | code.drafted | ...",
  "timestamp": "ISO-8601",
  "payload": { ... }
}
```

---

## 8. API Contract (REST)

**Base URL (development):** `http://localhost:4000`
**Base URL (production):** `https://api.orion.com` (or your DO droplet domain)
**All protected routes require header:** `Authorization: Bearer <jwt_token>`

### Auth Endpoints

#### `POST /api/auth/register`
```json
Request:  { "email": "string", "password": "string" }
Response: { "token": "jwt_string", "user": { "id": "uuid", "email": "string" } }
```

#### `POST /api/auth/login`
```json
Request:  { "email": "string", "password": "string" }
Response: { "token": "jwt_string", "user": { "id": "uuid", "email": "string" } }
```

### Task Endpoints

#### `POST /api/tasks` *(protected)*
Creates a new job.
```json
Request:  { "prompt": "Write a Python script to scrape Hacker News titles and save to CSV" }
Response: {
  "job_id": "uuid",
  "status": "PENDING",
  "created_at": "ISO-8601"
}
```

#### `GET /api/tasks/:id` *(protected)*
Polls current job state.
```json
Response: {
  "job_id": "uuid",
  "status": "CODING",
  "retry_count": 1,
  "plan_json": { ... },
  "code_draft": "...",
  "final_output": null,
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

#### `GET /api/tasks` *(protected)*
Returns all jobs for the authenticated user (newest first, limit 20).

#### `GET /api/tasks/failed` *(protected)* *(added: DLQ Inspector)*
Returns all jobs in `FAILED` state for the authenticated user, including their last `qa_feedback` and `qa_severity`. Reads from the DB (DLQ-sourced records) rather than hitting RabbitMQ directly. Useful for debugging failed pipelines.
```json
Response: [
  {
    "job_id": "uuid",
    "prompt": "string",
    "status": "FAILED",
    "qa_severity": 9,
    "qa_feedback": "string",
    "retry_count": 3,
    "created_at": "ISO-8601"
  }
]
```

#### `GET /api/tasks/:id/replay` *(protected)* *(added: Agent Replay Mode)*
Returns the full ordered `event_log` array for a completed or failed job. Used by the frontend `/replay/[jobId]` page to replay the pipeline animation without any LLM calls.
```json
Response: {
  "job_id": "uuid",
  "prompt": "string",
  "status": "COMPLETED",
  "event_log": [
    { "type": "AGENT_ACTIVATED", "agent": "planner", "timestamp": "ISO-8601" },
    { "type": "AGENT_LOG", "agent": "planner", "message": "Breaking down task...", "timestamp": "ISO-8601" },
    { "type": "STATUS_CHANGE", "old_status": "PENDING", "new_status": "PLANNING", "timestamp": "ISO-8601" },
    { "type": "TASK_COMPLETE", "final_output": "string", "language": "python", "timestamp": "ISO-8601" }
  ]
}
```

### Health & Metrics

#### `GET /health`
```json
{ "status": "ok", "service": "api-gateway", "timestamp": "ISO-8601" }
```

#### `GET /metrics`
Returns Prometheus metrics in text format (no auth required).

---

## 9. WebSocket Protocol

**Endpoint:** `ws://localhost:4001/ws` (dev) / `wss://api.orion.com/ws` (prod)

### Connection Flow
```
Client connects → ws://localhost:4001/ws
Client sends:   { "type": "SUBSCRIBE", "job_id": "uuid", "token": "jwt" }
Server replies: { "type": "SUBSCRIBED", "job_id": "uuid" }
```
Note: JWT is validated by the Notification Service on `SUBSCRIBE`. If invalid, server sends `{ "type": "ERROR", "message": "Unauthorized" }` and closes the connection.

### Events (Server → Client)

All events share this base shape:
```json
{
  "type": "EVENT_TYPE",
  "job_id": "uuid",
  "timestamp": "ISO-8601",
  ...additional fields
}
```

| Event Type | Trigger | Additional Fields |
|---|---|---|
| `SUBSCRIBED` | Client subscribed successfully | — |
| `AGENT_ACTIVATED` | Agent picked up a message | `"agent": "alnitak \| alnilam \| mintaka"` |
| `AGENT_LOG` | Agent emitting a progress log | `"agent": "string"`, `"message": "string"` |
| `STATUS_CHANGE` | Job status updated in DB | `"old_status": "string"`, `"new_status": "string"` |
| `TASK_COMPLETE` | QA approved, job done | `"final_output": "string"`, `"language": "string"` |
| `TASK_FAILED` | Max retries exceeded | `"reason": "string"`, `"retry_count": 3` |
| `QA_REJECTED` | QA rejected, retrying | `"feedback": "string"`, `"retry_count": 1 \| 2` |
| `ERROR` | Server-side error | `"message": "string"` |

---

## 10. Agent Logic & CrewAI Design

### CrewAI Setup Pattern (same for all three agents)

Each agent service is a standalone Python process that:
1. Connects to RabbitMQ on startup
2. Sets prefetch to 1
3. Awaits messages on its queue
4. On message receive:
   a. Publishes `AGENT_ACTIVATED` to `agent.progress`
   b. Runs the CrewAI task
   c. Publishes result to the next queue
   d. Updates PostgreSQL directly via `asyncpg`
   e. ACKs the RabbitMQ message
   f. Publishes relevant `AGENT_LOG` messages throughout

### Gemini Integration
```python
from langchain_google_genai import ChatGoogleGenerativeAI
from crewai import Agent, Task, Crew

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=os.environ["GEMINI_API_KEY"],
    temperature=0.3,  # Low temperature for deterministic code output
    streaming=True    # Enables token-by-token streaming (added: Agent Thought Streaming)
)
```

### Agent Thought Streaming (added)
All three agents use `streaming=True` on the LangChain LLM. Each streamed token chunk is published as an `AGENT_LOG` event to the `agent.progress` queue with `"stream": true`. The Notification Service forwards these to the frontend as they arrive. The `TerminalLog` component appends tokens in real-time, making the terminal feel like a live IDE rather than waiting for a complete response.

**Publishing streaming chunks from agents:**
```python
# In agent.py — callback handler for streaming
async def on_llm_new_token(token: str, job_id: str, agent_name: str):
    await publish_to_progress({
        "type": "AGENT_LOG",
        "agent": agent_name,
        "message": token,
        "stream": True,   # frontend appends, does not newline
        "timestamp": datetime.utcnow().isoformat()
    })
```

### Language Classifier (Planner Pre-step) (added)
Before the Planner calls Gemini for full decomposition, it runs a lightweight keyword classifier on the raw prompt to detect task domain. This sets the `language` field in the plan and selects a language-specialized system prompt suffix for the Coder agent.

```python
# In planner/agent.py
LANGUAGE_HINTS = {
    "python": ["scrape", "csv", "pandas", "data", "ml", "flask", "django", "api"],
    "javascript": ["react", "node", "npm", "frontend", "express", "html", "dom"],
    "bash": ["shell", "cron", "script", "grep", "awk", "deploy", "linux"],
}

def classify_language(prompt: str) -> str:
    prompt_lower = prompt.lower()
    scores = {lang: sum(1 for kw in kws if kw in prompt_lower)
              for lang, kws in LANGUAGE_HINTS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "python"  # default to python
```

The detected language is included in the plan JSON passed to the Coder. The Coder's system prompt is then conditionally suffixed with language-specific instructions (e.g., for Python: "prefer list comprehensions, use type hints, follow PEP 8"; for JS: "use async/await, prefer const, use ES2022+").

### Planner Agent Task Prompt
```
You are given the following user task:
"{prompt}"

Your job is to create a structured JSON execution plan. The plan must:
1. Identify the programming language best suited for the task
2. Break the task into 3-7 atomic, ordered steps
3. Describe exactly what code needs to be written in each step
4. State the expected final output

Return ONLY a valid JSON object. No markdown, no explanation. JSON only.
```

### Coder Agent Task Prompt (initial)
```
You are given the following execution plan:
{plan_json}

Write the complete, working code that implements this plan exactly.
Requirements:
- Code must be fully functional with no placeholders
- Include inline comments explaining key logic
- Handle edge cases and errors gracefully
- Do not include any explanation outside of code comments

Return ONLY the raw code. No markdown fences. No explanation.
```

### Coder Agent Task Prompt (retry/rejection)
```
Your previous code was rejected by the QA reviewer.
QA Feedback: "{qa_feedback}"

Original Plan: {plan_json}
Your rejected code:
{rejected_code}

Fix every issue identified in the QA feedback. Return ONLY the corrected code.
```

### QA Agent Task Prompt
```
Review the following {language} code:

{code}

The code was written to fulfill this plan: {plan_json}

Check for:
1. Logical errors or incorrect implementation
2. Security vulnerabilities (SQL injection, path traversal, hardcoded secrets, etc.)
3. Unhandled exceptions or edge cases
4. Whether the code actually satisfies the original plan

Your response must be a JSON object with exactly three fields:
{
  "decision": "PASS" or "FAIL",
  "severity": <integer 1-10 where 1=trivial style issue, 10=critical security vulnerability. Set to 0 if PASS.>,
  "feedback": "If PASS, write 'Code is correct and secure.' If FAIL, write specific, line-by-line feedback on every issue found."
}

Severity guide: 1-3 = minor style/readability; 4-7 = logic bugs or missing edge cases; 8-10 = security vulnerabilities or completely wrong implementation.

Return ONLY valid JSON. No markdown.
```

---

## 11. DevOps & Infrastructure

### Docker Compose Architecture

All backend services run in a single Docker Compose stack. The `docker-compose.yml` defines the full environment.

**Services in Compose:**
- `api-gateway` (Node.js, port 4000)
- `notification-service` (Python FastAPI, port 4001)
- `planner-agent` (Python)
- `coder-agent` (Python)
- `qa-agent` (Python)
- `rabbitmq` (RabbitMQ + Management UI, ports 5672, 15672)
- `postgres` (PostgreSQL, port 5432)
- `prometheus` (port 9090)
- `grafana` (port 3001)
- `nginx` (production only, ports 80, 443)

### `docker-compose.yml` Specification

```yaml
version: '3.9'

networks:
  orion-net:
    driver: bridge

volumes:
  postgres_data:
  rabbitmq_data:
  prometheus_data:
  grafana_data:

services:

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: orion
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - orion-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d orion"]
      interval: 10s
      timeout: 5s
      retries: 5

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - ./rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf
      - ./rabbitmq/definitions.json:/etc/rabbitmq/definitions.json
    ports:
      - "15672:15672"   # Management UI (dev only)
      - "5672:5672"
    networks:
      - orion-net
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 15s
      timeout: 10s
      retries: 5

  api-gateway:
    build:
      context: ./api-gateway
      dockerfile: Dockerfile
    image: ghcr.io/${GITHUB_USERNAME}/orion-api-gateway:${IMAGE_TAG:-latest}
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/orion
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      JWT_SECRET: ${JWT_SECRET}
      PORT: 4000
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - orion-net

  notification-service:
    build:
      context: ./notification-service
      dockerfile: Dockerfile
    image: ghcr.io/${GITHUB_USERNAME}/orion-notification:${IMAGE_TAG:-latest}
    environment:
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      JWT_SECRET: ${JWT_SECRET}
      PORT: 4001
    ports:
      - "4001:4001"
    depends_on:
      rabbitmq:
        condition: service_healthy
    networks:
      - orion-net

  planner-agent:
    build:
      context: ./agents/planner
      dockerfile: Dockerfile
    image: ghcr.io/${GITHUB_USERNAME}/orion-planner:${IMAGE_TAG:-latest}
    environment:
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/orion
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      rabbitmq:
        condition: service_healthy
      postgres:
        condition: service_healthy
    networks:
      - orion-net

  coder-agent:
    build:
      context: ./agents/coder
      dockerfile: Dockerfile
    image: ghcr.io/${GITHUB_USERNAME}/orion-coder:${IMAGE_TAG:-latest}
    environment:
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/orion
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      rabbitmq:
        condition: service_healthy
      postgres:
        condition: service_healthy
    networks:
      - orion-net

  qa-agent:
    build:
      context: ./agents/qa
      dockerfile: Dockerfile
    image: ghcr.io/${GITHUB_USERNAME}/orion-qa:${IMAGE_TAG:-latest}
    environment:
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/orion
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      rabbitmq:
        condition: service_healthy
      postgres:
        condition: service_healthy
    networks:
      - orion-net

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - orion-net

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    networks:
      - orion-net
```

### Dockerfile Specifications

**API Gateway (`api-gateway/Dockerfile`):**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app .
EXPOSE 4000
CMD ["node", "src/index.js"]
```

**Python Agents — shared base pattern (`agents/*/Dockerfile`):**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

---

## 12. CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/deploy.yml`)

**Triggers:**
- Push to `main` branch
- Pull Request to `main` (lint/test only, no deploy)

**Pipeline stages:**

```
Trigger: push to main
    │
    ▼
[Job: lint-and-test]
    ├── Checkout code
    ├── Setup Node 20 → Run ESLint on api-gateway
    ├── Setup Python 3.11 → Run flake8 on all agent services
    └── (No unit tests in Phase 1 — add in Phase 2)
    │
    ▼
[Job: build-and-push] (only on main branch)
    ├── Login to GHCR using GITHUB_TOKEN (no extra secrets needed)
    ├── Build Docker image: api-gateway → push to ghcr.io
    ├── Build Docker image: notification-service → push to ghcr.io
    ├── Build Docker image: planner-agent → push to ghcr.io
    ├── Build Docker image: coder-agent → push to ghcr.io
    └── Build Docker image: qa-agent → push to ghcr.io
    │   (All tagged with: latest + git SHA)
    ▼
[Job: deploy] (depends on build-and-push)
    ├── SSH into DigitalOcean Droplet (using DO_SSH_KEY secret)
    ├── Pull latest images from GHCR
    ├── Run: docker compose pull
    ├── Run: docker compose up -d --no-build
    └── Run: docker compose exec api-gateway npx prisma migrate deploy
```

**Required GitHub Secrets:**
```
DO_SSH_KEY          — Private SSH key for Droplet access
DO_HOST             — Droplet IP address
GEMINI_API_KEY      — Google AI Studio API key
JWT_SECRET          — Random 256-bit string
POSTGRES_USER       — e.g., orion_user
POSTGRES_PASSWORD   — Strong random password
RABBITMQ_USER       — e.g., orion_rmq
RABBITMQ_PASSWORD   — Strong random password
GRAFANA_PASSWORD    — Grafana admin password
GITHUB_USERNAME     — Your GitHub username (for GHCR image tags)
```

Note: `GITHUB_TOKEN` is automatically provided by Actions — no manual secret needed for GHCR login.

---

## 13. Monitoring & Observability

### Prometheus Configuration (`monitoring/prometheus.yml`)
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:4000']
    metrics_path: /metrics

  - job_name: 'notification-service'
    static_configs:
      - targets: ['notification-service:4001']
    metrics_path: /metrics

  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
    metrics_path: /metrics
```

### Key Metrics to Track
- `orion_tasks_total` — Counter: total tasks submitted
- `orion_tasks_completed_total` — Counter: tasks completed
- `orion_tasks_failed_total` — Counter: tasks failed
- `orion_agent_duration_seconds` — Histogram: time each agent takes per task
- `orion_queue_depth` — Gauge: messages in each RabbitMQ queue
- `orion_retry_count` — Histogram: distribution of retry counts

### Grafana Dashboard Panels
1. **Task Pipeline Funnel** — Bar chart: Submitted → Planning → Coding → Reviewing → Completed
2. **Agent Duration** — Line chart: avg duration of each agent over time
3. **Queue Depth** — Live gauge: messages waiting in each queue
4. **Success Rate** — Stat panel: (completed / total) %
5. **Active WebSocket Connections** — Gauge from notification service
6. **Retry Rate** — Chart: what % of jobs needed retries

---

## 14. Directory Structure

```
orion/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .devcontainer/
│   └── devcontainer.json          # GitHub Codespaces config
├── frontend/                       # Next.js app (deployed to Vercel separately)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Landing page
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Main task submission + observability canvas
│   │   ├── replay/
│   │   │   └── [jobId]/
│   │   │       └── page.tsx       # Agent Replay Mode — offline pipeline playback (added)
│   │   └── auth/
│   │       └── page.tsx           # Login/Register
│   ├── components/
│   │   ├── AgentCanvas.tsx        # React Flow node graph
│   │   ├── TerminalLog.tsx        # Streaming log window
│   │   ├── TaskForm.tsx           # Prompt input form
│   │   ├── OutputPanel.tsx        # Final output + download
│   │   └── QASeverityBadge.tsx    # Severity score badge (1–10) shown on completed jobs (added)
│   ├── hooks/
│   │   ├── useAgentSocket.ts      # WebSocket hook
│   │   └── useReplay.ts           # Replay hook — drives AgentCanvas from event_log (added)
│   ├── lib/
│   │   └── api.ts                 # Axios API client
│   ├── tailwind.config.ts
│   └── package.json
│
├── api-gateway/                    # Node.js/Express service
│   ├── src/
│   │   ├── index.js               # Entry point, Express setup
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   └── tasks.js
│   │   ├── middleware/
│   │   │   └── auth.js            # JWT validation middleware
│   │   ├── lib/
│   │   │   ├── rabbitmq.js        # RabbitMQ connection + publish helpers
│   │   │   └── prisma.js          # Prisma client singleton
│   │   └── metrics.js             # Prometheus prom-client setup
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── Dockerfile
│   └── package.json
│
├── notification-service/           # Python FastAPI service
│   ├── main.py                    # FastAPI app + WebSocket handler
│   ├── rabbitmq_consumer.py       # aio-pika async consumer
│   ├── connection_manager.py      # WebSocket connection registry
│   ├── Dockerfile
│   └── requirements.txt
│
├── agents/
│   ├── planner/
│   │   ├── main.py                # RabbitMQ consumer loop
│   │   ├── agent.py               # CrewAI agent definition + task
│   │   ├── db.py                  # asyncpg DB update helpers
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── coder/
│   │   ├── main.py
│   │   ├── agent.py
│   │   ├── db.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── qa/
│       ├── main.py
│       ├── agent.py
│       ├── db.py
│       ├── Dockerfile
│       └── requirements.txt
│
├── rabbitmq/
│   ├── rabbitmq.conf              # RabbitMQ config
│   └── definitions.json           # Pre-configured queues and exchanges
│
├── monitoring/
│   ├── prometheus.yml
│   └── grafana/
│       └── dashboards/
│           └── orion.json      # Grafana dashboard JSON
│
├── nginx/
│   └── nginx.conf                 # Reverse proxy config (production)
│
├── docker-compose.yml
├── docker-compose.override.yml    # Dev overrides (volume mounts for hot reload)
├── .env.example
└── README.md
```

---

## 15. Environment Variables

### `.env.example` (root)
```env
# Database
POSTGRES_USER=orion_user
POSTGRES_PASSWORD=change_me_strong_password
DATABASE_URL=postgresql://orion_user:change_me_strong_password@postgres:5432/orion

# RabbitMQ
RABBITMQ_USER=orion_rmq
RABBITMQ_PASSWORD=change_me_strong_password
RABBITMQ_URL=amqp://orion_rmq:change_me_strong_password@rabbitmq:5672

# Auth
JWT_SECRET=generate_a_256bit_random_string_here

# LLM
GEMINI_API_KEY=your_google_ai_studio_key_here

# Monitoring
GRAFANA_PASSWORD=change_me

# GitHub (for image tags in CI)
GITHUB_USERNAME=your_github_username
IMAGE_TAG=latest
```

### Frontend (Vercel Environment Variables)
```env
NEXT_PUBLIC_API_URL=https://your-droplet-ip:4000
NEXT_PUBLIC_WS_URL=wss://your-droplet-ip:4001
```

---

## 16. Development Setup (GitHub Codespaces)

### `.devcontainer/devcontainer.json`
```json
{
  "name": "Orion Dev",
  "image": "mcr.microsoft.com/devcontainers/universal:2",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/node:1": { "version": "20" },
    "ghcr.io/devcontainers/features/python:1": { "version": "3.11" }
  },
  "forwardPorts": [3000, 4000, 4001, 5672, 9090, 3001, 15672],
  "portsAttributes": {
    "3000":  { "label": "Frontend (Next.js)" },
    "4000":  { "label": "API Gateway" },
    "4001":  { "label": "Notification Service (WebSocket)" },
    "15672": { "label": "RabbitMQ Management UI" },
    "9090":  { "label": "Prometheus" },
    "3001":  { "label": "Grafana" }
  },
  "postCreateCommand": "cp .env.example .env && npm install --prefix api-gateway && pip install -r agents/planner/requirements.txt",
  "customizations": {
    "vscode": {
      "extensions": [
        "Prisma.prisma",
        "ms-python.python",
        "dbaeumer.vscode-eslint",
        "ms-azuretools.vscode-docker",
        "eamodio.gitlens",
        "humao.rest-client"
      ]
    }
  }
}
```

### First-time Codespaces Setup (run in order)

```bash
# 1. Copy env file and fill in your keys
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY and change passwords

# 2. Start infrastructure only (postgres + rabbitmq) first
docker compose up -d postgres rabbitmq

# 3. Wait for health checks, then run migrations
docker compose exec api-gateway npx prisma migrate dev --name init
# (or run prisma from host: cd api-gateway && npx prisma migrate dev)

# 4. Start all services
docker compose up -d

# 5. Verify all services are running
docker compose ps

# 6. Check RabbitMQ queues are set up
# Open Codespaces port 15672 → login with RABBITMQ_USER/RABBITMQ_PASSWORD
# You should see all queues defined in definitions.json

# 7. Start frontend (separate terminal)
cd frontend && npm install && npm run dev
```

### Scaling a Worker Locally (Docker Compose)
```bash
# Run 2 Coder agents simultaneously to handle parallel tasks
docker compose up -d --scale coder-agent=2
```
This is the Phase 1 equivalent of Kubernetes HPA. Two Coder pods competing for messages on `plan.completed`.

---

## 17. Build Order & Milestones

Build in this exact order. Each milestone must be fully working before moving to the next.

### Milestone 1 — Infrastructure Foundation
**Goal:** Get all infrastructure services running locally.
- [ ] Write `docker-compose.yml` with postgres, rabbitmq only
- [ ] Write `rabbitmq/definitions.json` to pre-configure all queues and the DLQ
- [ ] Verify RabbitMQ Management UI accessible on port 15672
- [ ] Verify PostgreSQL accessible
- **Done when:** `docker compose ps` shows both services healthy

### Milestone 2 — API Gateway
**Goal:** Working REST API that creates jobs and publishes to RabbitMQ.
- [ ] Initialize Node.js project, install Express, amqplib, prisma, jsonwebtoken, bcryptjs, prom-client
- [ ] Write Prisma schema and run first migration
- [ ] Implement `POST /api/auth/register` and `POST /api/auth/login`
- [ ] Implement JWT middleware
- [ ] Implement `POST /api/tasks` — creates DB record, publishes to `task.created`
- [ ] Implement `GET /api/tasks/:id`
- [ ] Implement RabbitMQ retry-on-connect logic (broker may not be ready immediately)
- [ ] Add to docker-compose.yml
- **Done when:** `curl -X POST localhost:4000/api/tasks` returns a job_id and a message appears in RabbitMQ Management UI

### Milestone 3 — Planner Agent
**Goal:** Agent picks up tasks, calls Gemini, publishes structured plan.
- [ ] Install: crewai, langchain-google-genai, aio-pika, asyncpg
- [ ] Write RabbitMQ consumer loop in `main.py`
- [ ] Write CrewAI agent definition in `agent.py`
- [ ] Write DB update helpers in `db.py`
- [ ] Publish `AGENT_ACTIVATED` and `AGENT_LOG` events to `agent.progress`
- [ ] Publish completed plan to `plan.completed`
- [ ] Add to docker-compose.yml
- **Done when:** Submit a task → see `plan.completed` queue receive a valid JSON plan in RabbitMQ UI

### Milestone 4 — Coder Agent
**Goal:** Agent picks up plan, generates code, handles rejections.
- [ ] Same structure as Planner Agent
- [ ] Implement retry logic: check `retry_count`, publish to `task.failed` if >= 3
- [ ] Handle both `plan.completed` and `code.rejected` queues
- **Done when:** `code.drafted` queue receives actual code after plan is published

### Milestone 5 — QA Agent
**Goal:** Agent reviews code and either approves or rejects with feedback and a severity score.
- [ ] Same structure as other agents
- [ ] Parse Gemini JSON response: `{ "decision": "PASS|FAIL", "severity": 1-10, "feedback": "..." }`
- [ ] Implement severity-based auto-pass: severity 1–3 → PASS with warning log, 4+ → evaluate normally
- [ ] On PASS: update DB to COMPLETED with `qa_severity`, publish to `task.completed`
- [ ] On FAIL: publish to `code.rejected` with feedback and `severity`
- [ ] Append every `AGENT_ACTIVATED`, `AGENT_LOG`, `STATUS_CHANGE`, and terminal event to `event_log` JSONB column on each DB update (all agents should do this — wire it in here as the pattern)
- **Done when:** A full end-to-end task runs: PENDING → PLANNING → CODING → REVIEWING → COMPLETED, visible in DB with populated `event_log` array and `qa_severity` set

### Milestone 6 — Notification Service
**Goal:** Real-time events delivered to clients via WebSocket.
- [ ] Install: fastapi, uvicorn, aio-pika, websockets, python-jose
- [ ] Implement `ConnectionManager` class
- [ ] Implement WebSocket endpoint with SUBSCRIBE protocol
- [ ] Subscribe to `agent.progress`, `task.completed`, `task.failed` queues
- [ ] Route messages to correct WebSocket clients by job_id
- **Done when:** Open a raw WebSocket client (wscat), subscribe to a job, submit a task, see events stream in real-time

### Milestone 7 — Frontend
**Goal:** Complete dashboard with real-time visual agent canvas, log streaming, severity display, and replay mode.
- [ ] Initialize Next.js 14 with Tailwind and React Flow
- [ ] Build `TaskForm` component — submits prompt, gets job_id
- [ ] Build `AgentCanvas` component — 3 nodes (Alnitak, Alnilam, Mintaka) that animate based on WS events; each node label shows both the star name and role (e.g. "Alnitak · Planner")
- [ ] Build `TerminalLog` component — append-only log stream; handle `"stream": true` tokens by appending chars to the current line without newline (added: Agent Thought Streaming)
- [ ] Build `OutputPanel` — shows final code with syntax highlighting and download button
- [ ] Build `QASeverityBadge` component — color-coded badge (green 1–3, yellow 4–7, red 8–10) shown on job completion (added: QA Severity Scoring)
- [ ] Implement `useAgentSocket` hook — manages WS lifecycle and dispatches events to components
- [ ] Implement `useReplay` hook — accepts `event_log[]` array, replays events at configurable speed via `setInterval`, drives `AgentCanvas` and `TerminalLog` state without any network calls (added: Agent Replay Mode)
- [ ] Build `/replay/[jobId]` page — fetches `GET /api/tasks/:id/replay`, passes `event_log` to `useReplay`, renders the full pipeline animation with a playback speed slider (0.5×, 1×, 2×, 4×) and a "Share Replay" copy-link button (added: Agent Replay Mode)
- [ ] Implement auth pages (login/register) with JWT storage in httpOnly cookie
- **Done when:** Full demo works in browser end-to-end, streaming terminal types out agent thoughts in real-time, completed jobs show a severity badge, and the replay page re-animates any past job from its stored event log

### Milestone 8 — CI/CD & Deployment
**Goal:** Automated deployment on push to main.
- [ ] Write GitHub Actions workflow
- [ ] Add all secrets to GitHub repository settings
- [ ] Provision DigitalOcean Droplet (Ubuntu 22.04, 2vCPU/4GB) using Student Pack credits
- [ ] Install Docker + Docker Compose on Droplet
- [ ] Set up GHCR login on Droplet
- [ ] Write `nginx/nginx.conf` as reverse proxy
- [ ] Test: push to main → images build → Droplet updates → site is live
- **Done when:** A git push deploys the app automatically with no manual steps

### Milestone 9 — Monitoring
**Goal:** Prometheus metrics + Grafana dashboard live.
- [ ] Add `prom-client` metrics to API Gateway
- [ ] Add `prometheus-fastapi-instrumentator` to Notification Service
- [ ] Write `monitoring/prometheus.yml`
- [ ] Import Grafana dashboard JSON
- [ ] Verify all 6 dashboard panels display data
- **Done when:** Grafana dashboard shows live task pipeline data

---

## 18. Known Constraints & Phase 2 Upgrades

### Current Constraints (Phase 1 — Acceptable)
- **No unit tests** — Testing is deferred. Agents are tested manually via the full pipeline.
- **No rate limiting** on API Gateway — Not needed for a portfolio demo with no real users.
- **No frontend auth with refresh tokens** — JWT stored in memory or localStorage for simplicity. Not production-secure but acceptable for demo.
- **Gemini free tier limits** — 1500 requests/day on the free tier. Sufficient for demo and development. Tasks that hit rate limits will have their jobs fail gracefully with a clear error message.
- **No coder-agent unit tests for generated code** — The QA agent acts as the only reviewer. Executing generated code in a sandbox is a Phase 2 feature.
- **Single Droplet** — No load balancing, no redundancy. Fine for portfolio.

### Phase 2 Upgrades (Document, Don't Build Now)
- **Kubernetes + KEDA:** Migrate from Docker Compose to a k3s cluster. Replace `--scale` with KEDA autoscaling on RabbitMQ queue depth. Each queue triggers scaling of its consumer service independently.
- **Code Sandbox Execution:** Instead of LLM-only QA, run the generated code in a sandboxed Docker container (e.g., using `docker run --rm --network none`) and feed stdout/stderr back to the QA Agent for real test results.
- **Multi-LLM Support:** Allow users to select GPT-4, Claude, or Gemini per agent via the UI. The language classifier (Section 10) can also be extended to route to the cheapest capable LLM per language domain.
- **PgBouncer:** Add connection pooling in front of PostgreSQL for higher concurrency.
- **JWT Refresh Tokens:** Implement proper refresh token rotation with httpOnly cookies.
- **Task History & Replay Sharing:** The replay page (Section 19) already stores and plays back local event logs. Phase 2 extends this with public shareable replay URLs and social embed previews (Open Graph meta tags auto-generated from the job prompt and final output).
- **Webhook Support:** Let users provide a callback URL to receive task completion notifications externally.

---

## 19. Optimizations & Unique Features

This section documents four additions beyond the base spec: three targeted optimizations that improve demo quality and engineering depth, and one unique feature that differentiates Orion from every comparable open-source multi-agent project.

---

### 19.1 Agent Thought Streaming

**What it does:** Instead of emitting discrete `AGENT_LOG` events only at key checkpoints, each agent streams Gemini's output token-by-token to the frontend terminal in real-time. The terminal feels like watching an IDE as the agent types — not like waiting for a spinner to resolve.

**Implementation surface:** ~10 lines of change across existing files.

**Backend change (all three agents):**
```python
# In agent.py — pass a streaming callback to CrewAI's LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=os.environ["GEMINI_API_KEY"],
    temperature=0.3,
    streaming=True
)

# Custom LangChain callback handler
from langchain.callbacks.base import BaseCallbackHandler

class RabbitMQStreamingHandler(BaseCallbackHandler):
    def __init__(self, job_id: str, agent_name: str, publish_fn):
        self.job_id = job_id
        self.agent_name = agent_name
        self.publish_fn = publish_fn

    async def on_llm_new_token(self, token: str, **kwargs):
        await self.publish_fn({
            "type": "AGENT_LOG",
            "agent": self.agent_name,
            "message": token,
            "stream": True,   # signals frontend: append, don't newline
            "timestamp": datetime.utcnow().isoformat()
        })
```

**Frontend change (`TerminalLog.tsx`):**
```typescript
// In useAgentSocket.ts dispatch logic:
if (event.type === "AGENT_LOG" && event.stream) {
  // Append token to current line buffer — do NOT push a new log entry
  setCurrentLine(prev => prev + event.message);
} else if (event.type === "AGENT_LOG") {
  // Flush buffer as a complete line, start new
  setLogs(prev => [...prev, currentLine]);
  setCurrentLine(event.message);
}
```

**WebSocket event shape (new `stream` field):**
```json
{ "type": "AGENT_LOG", "agent": "coder", "message": "def parse_csv(", "stream": true, "timestamp": "..." }
```

---

### 19.2 QA Severity Scoring

**What it does:** Replaces the binary PASS/FAIL QA decision with a 1–10 severity score. Minor issues (score 1–3) auto-pass with a warning rather than triggering a retry loop. Critical issues (score 8–10) are hard-rejected and stored for DLQ inspection. This makes the QA agent feel intelligent rather than a binary gatekeeper, and surfaces naturally as a color-coded badge in the UI.

**Severity bands:**

| Score | Band | Action |
|---|---|---|
| 0 | Pass | DB updated to COMPLETED |
| 1–3 | Minor | Auto-PASS, `AGENT_LOG` warning emitted, badge shown as green |
| 4–7 | Moderate | FAIL → retry, badge shown as yellow |
| 8–10 | Critical | Hard FAIL → retry, badge shown as red, stored in `qa_severity` column |

**QA Agent logic change (`agents/qa/agent.py`):**
```python
result = json.loads(gemini_response)
decision = result["decision"]
severity = result.get("severity", 0)
feedback = result["feedback"]

# Auto-pass minor issues
if decision == "FAIL" and severity <= 3:
    decision = "PASS"
    await publish_progress({
        "type": "AGENT_LOG",
        "agent": "qa",
        "message": f"Minor issues found (severity {severity}/10) — auto-passing. {feedback}"
    })

# Update DB with severity regardless of outcome
await db.update_job(job_id, qa_severity=severity)

if decision == "PASS":
    await publish_to("task.completed", {...})
else:
    await publish_to("code.rejected", {"qa_feedback": feedback, "severity": severity, ...})
```

**Frontend (`QASeverityBadge.tsx`):**
```tsx
const color = severity <= 3 ? "green" : severity <= 7 ? "yellow" : "red";
return <span className={`badge badge-${color}`}>QA Score: {severity}/10</span>;
```
Badge is shown in the `OutputPanel` on COMPLETED jobs and in the task history list.

---

### 19.3 DLQ Inspector Endpoint

**What it does:** Surfaces failed jobs — those that exhausted all 3 retries — through a dedicated API endpoint. Reads from the database (where `status = FAILED` jobs have been written by the Coder agent before routing to `task.dlq`), returns them with their final QA feedback and severity. Demonstrates production-grade DLQ thinking without requiring the consumer to read directly from RabbitMQ.

**Why it matters for CV/interviews:** This is the one feature most "demo" projects skip. A real production system always has a dead letter inspection mechanism. Adding this shows you understand failure modes, not just the happy path.

**API Gateway route (`api-gateway/src/routes/tasks.js`):**
```javascript
// GET /api/tasks/failed
router.get('/failed', authMiddleware, async (req, res) => {
  const failedJobs = await prisma.job.findMany({
    where: { userId: req.user.id, status: 'FAILED' },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      prompt: true,
      status: true,
      qaFeedback: true,
      qaSeverity: true,
      retryCount: true,
      createdAt: true,
      updatedAt: true
    }
  });
  res.json(failedJobs);
});
```

**Note:** Route must be defined before `GET /api/tasks/:id` in Express, otherwise `/failed` is treated as an `:id` parameter.

---

### 19.4 Agent Replay Mode *(Unique Feature)*

**What it does:** Every completed or failed job stores its full pipeline event sequence in the `event_log` JSONB column. A dedicated `/replay/[jobId]` frontend page fetches this log and re-animates the entire React Flow canvas + terminal — at adjustable playback speed — without touching any LLM, WebSocket, or live infrastructure. Each completed job becomes a permanent, shareable, offline-playable recording of its own pipeline.

**Why this is genuinely differentiating:** No other open-source multi-agent demo has this. AutoGen, CrewAI examples, and LangGraph demos are black-box runs. Orion turns every pipeline execution into a replayable artifact — a permanent recording of Alnitak, Alnilam, and Mintaka working in concert. This is the killer demo feature — a recruiter or interviewer can be sent a replay link and watch the agents work without submitting a new task.

#### Event Log Storage (all agents)

Every agent appends to `event_log` as a side effect of each DB update. The append is an atomic PostgreSQL JSONB array append:

```sql
-- Append a new event to the array
UPDATE jobs
SET event_log = event_log || $1::jsonb
WHERE id = $2;
```

```python
# In agents/*/db.py — shared helper
async def append_event(conn, job_id: str, event: dict):
    event["timestamp"] = datetime.utcnow().isoformat()
    await conn.execute(
        "UPDATE jobs SET event_log = event_log || $1::jsonb WHERE id = $2",
        json.dumps([event]), job_id
    )
```

Every `AGENT_ACTIVATED`, `AGENT_LOG`, `STATUS_CHANGE`, `QA_REJECTED`, `TASK_COMPLETE`, and `TASK_FAILED` event that is published to `agent.progress` is also appended to `event_log` via this helper.

#### API Endpoint

`GET /api/tasks/:id/replay` — documented in Section 8. Returns the full `event_log` array plus job metadata. No LLM calls, no RabbitMQ reads — pure DB read.

#### Frontend Implementation

**`useReplay.ts` hook:**
```typescript
import { useState, useEffect, useRef } from "react";

export function useReplay(eventLog: AgentEvent[], speed: number = 1) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const BASE_INTERVAL_MS = 300; // base delay between events at 1× speed

  useEffect(() => {
    if (!isPlaying || currentIndex >= eventLog.length - 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => prev + 1);
    }, BASE_INTERVAL_MS / speed);

    return () => clearInterval(intervalRef.current!);
  }, [isPlaying, currentIndex, speed]);

  const play = () => { setCurrentIndex(0); setIsPlaying(true); };
  const pause = () => setIsPlaying(false);
  const reset = () => { setCurrentIndex(-1); setIsPlaying(false); };

  // Current event to dispatch to AgentCanvas / TerminalLog
  const currentEvent = currentIndex >= 0 ? eventLog[currentIndex] : null;

  return { currentEvent, currentIndex, total: eventLog.length, play, pause, reset };
}
```

**`/replay/[jobId]/page.tsx`:**
```tsx
"use client";
import { useReplay } from "@/hooks/useReplay";
import AgentCanvas from "@/components/AgentCanvas";
import TerminalLog from "@/components/TerminalLog";
import { useState, useEffect } from "react";
import axios from "axios";

export default function ReplayPage({ params }: { params: { jobId: string } }) {
  const [eventLog, setEventLog] = useState([]);
  const [speed, setSpeed] = useState(1);
  const { currentEvent, currentIndex, total, play, pause, reset } = useReplay(eventLog, speed);

  useEffect(() => {
    axios.get(`/api/tasks/${params.jobId}/replay`)
      .then(res => setEventLog(res.data.event_log));
  }, [params.jobId]);

  const shareUrl = `${window.location.origin}/replay/${params.jobId}`;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      <div className="flex items-center gap-4 p-4 border-b border-gray-800">
        <h1 className="text-lg font-mono">Agent Replay</h1>
        <span className="text-gray-400 text-sm">{currentIndex + 1} / {total} events</span>
        <button onClick={play}  className="btn-sm btn-green">▶ Play</button>
        <button onClick={pause} className="btn-sm btn-yellow">⏸ Pause</button>
        <button onClick={reset} className="btn-sm btn-gray">⏮ Reset</button>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
                className="bg-gray-800 px-2 py-1 rounded text-sm">
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
        <button onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="btn-sm btn-blue ml-auto">🔗 Copy Replay Link</button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <AgentCanvas replayEvent={currentEvent} />
        <TerminalLog replayEvent={currentEvent} />
      </div>
    </div>
  );
}
```

Both `AgentCanvas` and `TerminalLog` accept an optional `replayEvent` prop. When present, they process it exactly as they would a live WebSocket event — no component changes required beyond adding the prop.

#### Grafana Panel Addition (optional)
Add a 7th Grafana panel: **"Replay Views"** — a counter of `GET /api/tasks/:id/replay` hits tracked via `prom-client`, showing which jobs are most frequently replayed. Useful for understanding which task types generate the most interest.

---

*End of Specification — Orion v1.0*
*Last updated: April 2026*
*Author: Shivansh Rao*
