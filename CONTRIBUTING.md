# Phase 1 — Project Scaffold

This document covers what was built in Phase 1 and how to get a new team member up and running.

---

## What is this project?

A platform for testing **Salesforce AgentForce AI agents**. Connect to a Salesforce org, generate intelligent test personas and questions using GPT-4o, run automated conversations against your agents, and evaluate the results.

---

## Repository Structure

```
testing_agent/
│
├── server/                    ← Python FastAPI backend
│   ├── main.py                ← App entry point, CORS, /health
│   ├── config.py              ← Pydantic settings (reads from .env)
│   ├── requirements.txt       ← Python dependencies
│   ├── alembic.ini            ← Alembic migration config
│   ├── alembic/               ← Migration environment + versions
│   ├── models/
│   │   ├── database.py        ← SQLAlchemy engine, Base, get_db()
│   │   ├── tables.py          ← 12 ORM models
│   │   └── __init__.py
│   └── api/
│       ├── routes/            ← Route handlers (Phase 3+)
│       └── services/          ← Business logic (Phase 3+)
│
├── client/                    ← Next.js 15 frontend
│   ├── src/app/               ← App Router pages
│   ├── .env.local             ← NEXT_PUBLIC_API_URL
│   └── package.json
│
├── packages/
│   └── shared/                ← TypeScript types shared with the frontend
│       └── src/types.ts       ← AgentConfig, TestScenario, TestRun, ConversationTurn
│
├── pnpm-workspace.yaml        ← pnpm monorepo workspace config
├── tsconfig.base.json         ← Shared TypeScript config
├── .prettierrc
├── README.md
└── CONTRIBUTING.md            ← This file
```

---

## What is a Monorepo?

Instead of three separate repositories (backend, frontend, shared library), everything lives in one place:

- Change a shared TypeScript type once → the frontend sees it immediately
- One `git clone` gets you everything
- Single source of truth for the whole platform

The **backend** (`server/`) is Python. The **frontend** (`client/`) and **shared types** (`packages/shared/`) are TypeScript/Node.js. Both live here together.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | ≥ 3.11 | `python --version` |
| conda | any | `conda --version` |
| PostgreSQL | ≥ 16 | `psql --version` |
| Node.js | ≥ 22 | `node --version` |
| pnpm | ≥ 9.15 | `pnpm --version` — install with `npm i -g pnpm` |

---

## First-Time Setup

### 1. Clone the repository

```bash
git clone https://github.com/TribusPoint/testing_agent.git
cd testing_agent
```

### 2. Set up the Python environment

The project uses the shared `v1_env` conda environment:

```bash
conda activate v1_env
pip install -r server/requirements.txt
```

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE testing_agent;"
```

### 4. Configure environment variables

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in your values:

```ini
APP_ENV=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/testing_agent
DATABASE_URL_SYNC=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/testing_agent
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
SECRET_KEY=change-me-in-production
```

### 5. Run database migrations

```bash
cd server
alembic upgrade head
```

Verify all 12 tables were created:

```bash
psql -U postgres -d testing_agent -c "\dt"
```

### 6. Start the backend

```bash
conda activate v1_env
cd server
uvicorn main:app --reload --port 8080
```

Verify: `curl http://localhost:8080/health` → `{"status":"ok","env":"development"}`

Swagger UI: `http://localhost:8080/docs`

### 7. Install frontend dependencies and start the client

```bash
cd client
pnpm install
pnpm dev      # http://localhost:3000
```

---

## Day-to-Day Development

### Working on the backend (`server/`)

```bash
conda activate v1_env
cd server
uvicorn main:app --reload --port 8080
```

Key files:
- `main.py` — add new route includes here
- `api/routes/` — one file per resource (connections, agents, projects, etc.)
- `api/services/` — business logic called by routes
- `models/tables.py` — add new SQLAlchemy models here
- `config.py` — add new environment variables here

After changing models, generate and apply a migration:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

### Working on the frontend (`client/`)

```bash
cd client
pnpm dev      # http://localhost:3000
```

Key files:
- `src/app/` — pages (each folder = a URL route)
- `src/components/` — reusable UI components (create as needed)
- `.env.local` — set `NEXT_PUBLIC_API_URL=http://localhost:8080`

### Working on shared types (`packages/shared/`)

```bash
cd packages/shared
pnpm build
```

When you change `src/types.ts`, rebuild so the client picks up the changes.

---

## Tech Stack Reference

| Layer | Technology | Why |
|---|---|---|
| Backend language | Python 3.13 | All Salesforce + LLM integration logic is Python-native |
| Backend framework | FastAPI + Uvicorn | Async, fast, auto Swagger docs |
| ORM | SQLAlchemy (async) | Flexible, battle-tested |
| Migrations | Alembic | Schema versioning |
| Database | PostgreSQL 16 | Relational data with JSONB for flexible fields |
| LLM | OpenAI GPT-4o | Persona + question generation, evaluation |
| Salesforce | AgentForce REST API | `einstein/ai-agent/v1` + Tooling API |
| Frontend | Next.js 15 + Tailwind CSS | App Router, React Server Components |
| Shared types | `packages/shared` (TypeScript) | One source of truth for API shapes |
| Package manager (frontend) | pnpm | Monorepo support, fast installs |

---

## Common Issues

**`ModuleNotFoundError: No module named 'config'`**
→ Run uvicorn from inside the `server/` directory, not from the repo root.

**`alembic init alembic` fails — directory already exists**
→ Run `rm -rf server/alembic` first, then re-run `alembic init alembic`.

**`alembic revision` fails with `No module named 'models.database'`**
→ Make sure `models/database.py` exists (not just `database.py` in the server root).

**Port 8080 already in use**
→ `lsof -ti:8080 | xargs kill`

**Port 3000 already in use**
→ `lsof -ti:3000 | xargs kill`

**`pnpm: command not found`**
→ `npm install -g pnpm`

---

## Questions?

Reach out to the team lead or open a GitHub issue at [TribusPoint/testing_agent](https://github.com/TribusPoint/testing_agent).
