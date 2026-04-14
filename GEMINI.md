# Orion_v1 — Gemini CLI Master Instructions

> This file is your system prompt. Read it fully before writing any code.
> It is the ground truth for every decision in this project.

---

## Prime Directive

Write **complete, production-ready, fully working code** for every file.
- Zero placeholders. Zero TODOs. Zero stub functions.
- Every function must have a full implementation.
- Every route must have full request handling, validation, and error handling.
- Every component must be fully wired to its data source.
- The **only human task** is pasting real values into `.env`.
- `.env.example` must be kept updated with every key you introduce, with a one-line comment explaining each one.

---

## Project Identity

- **Name:** Orion_v1
- **Purpose:** Event-driven microservices platform that orchestrates three specialized LLM agents — Alnitak (Planner), Alnilam (Coder), Mintaka (QA) — to complete software tasks autonomously end-to-end.
- **Spec file:** `SPEC.md` — read it first, always. It is the single source of truth.

---

## Architecture (Do Not Deviate)

```
Frontend (Next.js 14, Vercel)
    │ HTTPS REST          │ WebSocket
    ▼                     ▼
API Gateway           Notification Service
(Node/Express :4000)  (Python FastAPI :4001)
    │ Publish              │ Subscribe
    ▼                      ▼
              RabbitMQ (orion exchange, direct)
              Queues: task.created → plan.completed → code.drafted
                      code.rejected → task.completed → task.failed
                      agent.progress → task.dlq (DLQ)
    │                      │
    ▼                      ▼
Planner (Alnitak)   Coder (Alnilam)   QA (Mintaka)
(CrewAI + Gemini)   (CrewAI + Gemini) (CrewAI + Gemini)
    │
    ▼
PostgreSQL 16 (all agents read/write via asyncpg)
    │
Prometheus + Grafana (monitoring)
```

---

## Full Tech Stack

### Frontend
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS
- Graph UI: React Flow (agent node canvas — Alnitak, Alnilam, Mintaka as nodes)
- Real-time: Native WebSocket API (no Socket.io)
- HTTP Client: Axios
- Deployment: Vercel

### API Gateway
- Runtime: Node.js 20
- Framework: Express.js
- Auth: `jsonwebtoken` + `bcryptjs`
- RabbitMQ: `amqplib`
- DB: Prisma Client (PostgreSQL)
- Port: 4000
- Metrics: `prom-client`

### Notification Service
- Runtime: Python 3.11
- Framework: FastAPI + uvicorn
- WebSocket: FastAPI native
- RabbitMQ: `aio-pika` (async)
- Port: 4001
- Metrics: `prometheus-fastapi-instrumentator`

### Agent Workers (3 services — same pattern)
- Runtime: Python 3.11
- Framework: CrewAI 0.28+
- LLM: Google Gemini 1.5 Flash via `langchain-google-genai`
- DB: `asyncpg` (direct PostgreSQL, no ORM)
- RabbitMQ: `aio-pika`
- Services: `planner-agent` (Alnitak), `coder-agent` (Alnilam), `qa-agent` (Mintaka)

### Infrastructure
- Docker + Docker Compose v2
- RabbitMQ 3.13 with Management UI (ports 5672, 15672)
- PostgreSQL 16
- Nginx (production reverse proxy)
- CI/CD: GitHub Actions → GHCR → DigitalOcean Droplet
- Container Registry: GHCR (ghcr.io)

---

## Directory Structure (Exact — Do Not Change)

```
Orion_v1/
├── api-gateway/
│   ├── src/
│   │   ├── routes/          # auth.js, tasks.js
│   │   ├── middleware/      # auth.js (JWT validation)
│   │   ├── services/        # rabbitmq.js, prisma.js
│   │   └── index.js
│   ├── prisma/
│   │   └── schema.prisma
│   ├── Dockerfile
│   └── package.json
├── notification-service/
│   ├── main.py
│   ├── ws_manager.py        # connection_map keyed by job_id
│   ├── rabbitmq.py          # aio-pika subscriber
│   ├── Dockerfile
│   └── requirements.txt
├── agents/
│   ├── shared/
│   │   └── db.py            # asyncpg helpers + append_event()
│   ├── planner/
│   │   ├── agent.py         # Alnitak — CrewAI Planner
│   │   ├── main.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── coder/
│   │   ├── agent.py         # Alnilam — CrewAI Coder
│   │   ├── main.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── qa/
│       ├── agent.py         # Mintaka — CrewAI QA
│       ├── main.py
│       ├── Dockerfile
│       └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Dashboard — submit task, job list
│   │   ├── tasks/[id]/page.tsx   # Live job view — React Flow + terminal
│   │   └── replay/[jobId]/page.tsx # Replay page
│   ├── components/
│   │   ├── AgentCanvas.tsx       # React Flow node graph
│   │   ├── TerminalLog.tsx       # Streaming log output
│   │   └── JobList.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   └── useReplay.ts
│   ├── lib/
│   │   └── api.ts                # Axios instance
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── nginx/
│   │   └── nginx.conf
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       └── dashboards/           # orion-dashboard.json
├── .github/
│   └── workflows/
│       ├── build-push.yml        # Build + push to GHCR
│       └── deploy.yml            # SSH deploy to DigitalOcean
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── GEMINI.md
└── SPEC.md
```

---

## Database Schema (Exact)

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
  qaSeverity  Int?      @map("qa_severity")
  eventLog    Json      @default("[]") @map("event_log")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  completedAt DateTime? @map("completed_at")
  user        User      @relation(fields: [userId], references: [id])
  @@map("jobs")
}
```

### Job Status Values (strict — use these exact strings)
`PENDING` → `PLANNING` → `CODING` → `REVIEWING` → `COMPLETED` | `FAILED`

---

## RabbitMQ Contract

- Exchange: `orion` (direct)
- All queues: `durable: true`
- Message persistence: `deliveryMode: 2`
- ACK: Manual only — ACK after DB update, never on receive
- Prefetch: 1 per worker
- DLQ: `task.dlq`

### Standard Message Envelope (every queue)
```json
{
  "job_id": "uuid-v4",
  "event": "task.created | plan.completed | ...",
  "timestamp": "ISO-8601",
  "payload": { ... }
}
```

### Queue Map
| Queue | Producer | Consumer |
|---|---|---|
| `task.created` | API Gateway | Planner (Alnitak) |
| `plan.completed` | Planner | Coder (Alnilam) |
| `code.drafted` | Coder | QA (Mintaka) |
| `code.rejected` | QA | Coder |
| `task.completed` | QA | Notification Service |
| `task.failed` | Coder | Notification Service |
| `agent.progress` | All agents | Notification Service |
| `task.dlq` | RabbitMQ | — (dead letter) |

---

## Agent Definitions (CrewAI — exact)

### Alnitak — Planner
```python
Agent(
  role="Senior Software Architect",
  goal="Decompose the user's task into a clear, step-by-step JSON execution plan that a developer can follow precisely.",
  backstory="You are an expert at breaking down complex software requirements into atomic, ordered development steps.",
  llm=gemini_llm
)
```

### Alnilam — Coder
```python
Agent(
  role="Expert Software Developer",
  goal="Write clean, working, well-commented code that precisely implements the given plan. Fix issues identified by the QA reviewer when code is rejected.",
  backstory="You are a senior developer who writes production-quality code. When your code is rejected, you carefully read the feedback and fix every issue.",
  llm=gemini_llm
)
```

### Mintaka — QA
```python
Agent(
  role="Senior QA Engineer & Security Reviewer",
  goal="Rigorously review code for correctness, security vulnerabilities, and adherence to the original plan. Return a severity-scored JSON decision. Approve only code that is production-ready.",
  backstory="You are a meticulous code reviewer who catches bugs others miss. You provide specific, actionable feedback when rejecting code, and assign a severity score that reflects how serious the issues are.",
  llm=gemini_llm
)
```

### Gemini LLM Init (all agents)
```python
from langchain_google_genai import ChatGoogleGenerativeAI
import os

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=os.environ["GEMINI_API_KEY"],
    temperature=0.3,
    streaming=True
)
```

---

## QA Severity Rules (exact)
- `severity 1–3` → Auto-PASS with warning logged. Code accepted.
- `severity 4–7` → FAIL. Coder retries with feedback.
- `severity 8–10` → Hard FAIL. Coder retries, severity stored in DB for DLQ inspection.

---

## Retry Logic (Coder — exact)
- `retry_count < 3` → Re-code with `qa_feedback`. Publish to `code.drafted` with `retry_count + 1`.
- `retry_count >= 3` → Do NOT process. Publish to `task.failed`. Update DB `status = FAILED`.

---

## WebSocket Protocol

**Endpoint:** `ws://notification-service:4001/ws`

**Subscribe flow:**
```json
Client → { "type": "SUBSCRIBE", "job_id": "uuid", "token": "jwt" }
Server → { "type": "SUBSCRIBED", "job_id": "uuid" }
```

**Server → Client event types:**
```json
{ "type": "AGENT_ACTIVATED", "agent": "alnitak|alnilam|mintaka", "job_id": "...", "timestamp": "..." }
{ "type": "AGENT_LOG", "agent": "...", "message": "...", "stream": true, "job_id": "...", "timestamp": "..." }
{ "type": "STATUS_CHANGE", "old_status": "...", "new_status": "...", "job_id": "...", "timestamp": "..." }
{ "type": "TASK_COMPLETE", "final_output": "...", "language": "...", "job_id": "...", "timestamp": "..." }
{ "type": "TASK_FAILED", "reason": "...", "retry_count": 3, "job_id": "...", "timestamp": "..." }
{ "type": "QA_REJECTED", "feedback": "...", "retry_count": 1, "job_id": "...", "timestamp": "..." }
```

JWT must be validated on SUBSCRIBE. Invalid JWT → send ERROR and close connection.

---

## API Endpoints (Express — exact)

### Auth (no JWT required)
- `POST /api/auth/register` → `{ email, password }` → `{ token, user }`
- `POST /api/auth/login` → `{ email, password }` → `{ token, user }`

### Tasks (JWT required — `Authorization: Bearer <token>`)
- `POST /api/tasks` → `{ prompt }` → `{ job_id, status, created_at }`
- `GET /api/tasks` → array of user's jobs (newest first, limit 20)
- `GET /api/tasks/failed` → array of FAILED jobs with qa_feedback/qa_severity
- `GET /api/tasks/:id` → full job state
- `GET /api/tasks/:id/replay` → `{ job_id, prompt, status, event_log[] }`

> ⚠️ CRITICAL: Define `GET /api/tasks/failed` BEFORE `GET /api/tasks/:id` in Express — otherwise `/failed` is treated as an `:id` parameter.

### Health & Metrics
- `GET /health` → `{ status: "ok", service: "api-gateway", timestamp }`
- `GET /metrics` → Prometheus text format (no auth)

---

## Unique Features to Implement Fully

### 1. Agent Replay Mode
- Every agent appends all events to `event_log` JSONB column via `append_event()` in `agents/shared/db.py`
- `GET /api/tasks/:id/replay` returns the full `event_log` array
- Frontend `/replay/[jobId]/page.tsx` uses `useReplay.ts` hook to re-animate the React Flow canvas + terminal at adjustable playback speed (0.5×, 1×, 2×, 4×)
- No LLM calls during replay — pure DB read

### 2. Agent Thought Streaming
- All agents use `streaming=True` on Gemini LLM
- Each streamed token is published to `agent.progress` with `"stream": true`
- Notification Service forwards these to frontend immediately
- TerminalLog component appends tokens in real-time (no newline between stream chunks)

### 3. Language Classifier (Planner pre-step)
- Before calling Gemini, Planner runs a keyword classifier on the raw prompt
- Detected language (`python | javascript | bash`) is set in the plan JSON
- Coder uses language-specific system prompt suffix based on detected language

### 4. QA Severity Scoring
- QA returns `severity` integer 1–10 alongside `decision` and `feedback`
- Stored in `qa_severity` column in DB
- Used for auto-pass logic (1–3), retry logic (4–7), hard-fail logic (8–10)

### 5. DLQ Inspector UI
- `GET /api/tasks/failed` returns all failed jobs
- Frontend displays failed jobs with qa_feedback and qa_severity
- Grafana panel shows DLQ count metric

### 6. Prometheus Metrics
**API Gateway (`prom-client`):**
- `http_requests_total` (counter, labels: method, route, status)
- `active_jobs_total` (gauge)
- `task_completed_total` (counter)
- `task_failed_total` (counter)

**Notification Service + Agents:**
- `prometheus-fastapi-instrumentator` (auto-instruments FastAPI)
- `agent_tasks_processed_total` (counter, label: agent_name)
- `agent_processing_duration_seconds` (histogram)

**Grafana Dashboard (7 panels):**
1. Jobs submitted per minute
2. Active jobs gauge
3. Agent processing time (histogram)
4. Task success rate
5. QA rejection rate
6. DLQ count
7. Replay views counter

---

## env Handling Rules
- Never hardcode secrets, tokens, or API keys anywhere in code
- Always read from `os.environ` (Python) or `process.env` (Node)
- `.env.example` must list EVERY key with a one-line comment
- Agents connect to Postgres via `DATABASE_URL`, not individual host/port vars

---

## Code Quality Rules
- Full try/catch (Node) or try/except (Python) on every async operation
- Input validation on every API endpoint (check required fields, types)
- Agents: always ACK RabbitMQ message after DB update succeeds — never before
- No dead code, no commented-out blocks left in final files
- Python: type hints on all function signatures
- Node: async/await throughout, no callbacks

---

## Decision Rules
- If SPEC.md is ambiguous, make the best engineering decision, note it at the end of your response, and continue — never stop mid-task to ask
- Prefer simplicity when the spec doesn't specify
- Never introduce libraries not listed in the tech stack without flagging it

---

## Build Order (follow exactly)

1. `docker-compose.yml` + all `Dockerfiles` + `.env.example`
2. `api-gateway/prisma/schema.prisma` + migration
3. API Gateway — complete (auth routes, task routes, RabbitMQ publisher, JWT middleware, Prometheus metrics)
4. Notification Service — complete (WS manager, RabbitMQ subscriber, JWT validation on subscribe)
5. `agents/shared/db.py` — asyncpg helpers + `append_event()`
6. Planner Agent (Alnitak) — complete with language classifier + thought streaming
7. Coder Agent (Alnilam) — complete with retry logic + language-specific prompts
8. QA Agent (Mintaka) — complete with severity scoring + auto-pass logic
9. Frontend — all pages and components (Dashboard, Task view, Replay page)
10. Frontend — React Flow canvas (AgentCanvas), TerminalLog (streaming), useWebSocket, useReplay hooks
11. Prometheus config + Grafana dashboard JSON (all 7 panels)
12. GitHub Actions workflows (build-push.yml, deploy.yml)
13. Nginx config (production)
14. Final check — list every file created, flag anything needing human input beyond `.env`
