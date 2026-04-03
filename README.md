# Testing Agent — Salesforce AgentForce Testing Platform

A platform for testing Salesforce AgentForce AI agents. Connect to a Salesforce org, generate intelligent test personas and questions using LLMs, run automated conversations against your agents, and evaluate the results.

---

## Architecture Overview

```
testing_agent/
├── server/              Python FastAPI — REST API, Salesforce integration, LLM generation, test runner
├── client/              Next.js 15 — dashboard UI (3-tab app)
└── packages/shared/     TypeScript domain types shared with the frontend
```

**Stack:**

| Layer | Technology |
|---|---|
| Backend | Python 3.13 + FastAPI + Uvicorn |
| ORM | SQLAlchemy (async) + Alembic migrations |
| Database | PostgreSQL 16 |
| LLM | OpenAI GPT-4o (persona + question generation, evaluation) |
| Salesforce | AgentForce REST API (`einstein/ai-agent/v1`) + Tooling API |
| Frontend | Next.js 15 App Router + Tailwind CSS |
| Shared types | TypeScript (`packages/shared/`) |

---

## Application — 3 Tabs

| Tab | Purpose |
|---|---|
| **1 — Connection Test** | Add a Salesforce org, authenticate, browse available agents, send a manual message |
| **2 — Context Gathering** | Create a test project, generate personas, dimensions, personality profiles, and initiating questions via GPT-4o |
| **3 — Test Runner** | Run generated questions against an agent, capture full transcripts, view pass/fail results |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | ≥ 3.11 | Use `conda activate v1_env` |
| PostgreSQL | ≥ 16 | Local install |
| Node.js | ≥ 22 | For the Next.js client |
| pnpm | ≥ 9.15 | `npm i -g pnpm` |

---

## Phase 1 — Project Scaffold ✅

**What was built:**

- Monorepo root: `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc`, `.prettierrc`
- `packages/shared/src/types.ts` — TypeScript interfaces: `AgentConfig`, `TestScenario`, `TestRun`, `ConversationTurn`
- `client/` — Next.js 15 App Router + Tailwind CSS, scaffolded with `create-next-app`

---

## Phase 2 — Data Layer ✅

**What was built:**

### `server/` — Python FastAPI

| File | Purpose |
|---|---|
| `main.py` | FastAPI app, CORS middleware, `/health` endpoint |
| `config.py` | Pydantic `Settings` — loads all env vars from `.env` |
| `models/database.py` | Async SQLAlchemy engine, `AsyncSessionLocal`, `Base`, `get_db()` dependency |
| `models/tables.py` | 12 SQLAlchemy ORM models (see table below) |
| `models/__init__.py` | Exports all models |
| `alembic/` | Migration environment — `env.py` wired to `Base.metadata` |
| `alembic.ini` | Alembic config pointing at local PostgreSQL |
| `requirements.txt` | All Python dependencies |

### Database Schema — 12 Tables

| Table | Purpose |
|---|---|
| `salesforce_connections` | Salesforce org credentials (domain, consumer key/secret) |
| `agents` | Agents fetched from Salesforce (topics, actions stored as JSONB) |
| `test_projects` | Test project (company name, industry, competitors, websites) |
| `project_agents` | M2M: which agents belong to a project |
| `personas` | AI-generated user personas per project/agent |
| `products` | Products/services associated with a project |
| `dimensions` | Question categories (e.g. "Refund Policy", "Pricing") |
| `dimension_values` | Values within a dimension |
| `personality_profiles` | Tester personality types (e.g. aggressive, friendly, confused) |
| `initiating_questions` | Generated test questions (persona + dimension + personality combo) |
| `test_runs` | A test execution — links project, agent, status, progress |
| `test_run_results` | Per-question result — question, response, follow-ups, latency, pass/fail |

### Running Migrations

```bash
conda activate v1_env
cd testing_agent/server

# Generate a new migration after model changes
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Verify tables
psql -U postgres -d testing_agent -c "\dt"
```

---

## Getting Started

### Backend

```bash
conda activate v1_env
cd testing_agent/server
uvicorn main:app --reload --port 8080
```

Verify: `curl http://localhost:8080/health` → `{"status":"ok","env":"development"}`

Swagger UI: `http://localhost:8080/docs`

### Frontend

```bash
cd testing_agent/client
pnpm install
pnpm dev      # http://localhost:3000
```

---

## Environment Variables

### `server/.env` (not committed)

| Variable | Description |
|---|---|
| `APP_ENV` | `development` / `production` |
| `DEBUG` | `true` / `false` |
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@localhost:5432/testing_agent` |
| `DATABASE_URL_SYNC` | `postgresql+psycopg2://user:pass@localhost:5432/testing_agent` |
| `OPENAI_API_KEY` | GPT-4o key for persona/question generation |
| `ANTHROPIC_API_KEY` | Optional — Claude for evaluation |
| `SECRET_KEY` | App secret |

### `client/.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Backend base URL |

---

## Implementation Phases

| Phase | Status | Description |
|---|---|---|
| **1 — Scaffold** | ✅ Done | Monorepo, Next.js client, shared TypeScript types |
| **2 — Data Layer** | ✅ Done | FastAPI server, 12-table PostgreSQL schema, Alembic |
| **3 — Salesforce Connection & Agent Discovery** | ✅ Done | OAuth flows, agent fetch/sync, connection test, manual chat UI |
| **4 — Context Gathering** | ✅ Done | Test projects, GPT-4o generation of personas/dimensions/profiles/questions |
| **5 — Test Runner** | ✅ Done | Run questions against AgentForce, inspired-utterance follow-ups, transcripts |
| **6 — Frontend** | ✅ Done | Next.js 3-tab UI: Connections, Projects, Runs |
| **7 — Evaluation & Reporting** | 🔜 Next | LLM-as-judge scoring, run summary stats, CSV export |
| **8 — Auth & Multi-tenancy** | ⬜ Pending | User accounts, org-level isolation |
