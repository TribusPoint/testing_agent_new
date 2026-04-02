# Agent Dev — Agent Testing Framework

A platform for testing AI agents against each other. Define agent configs, build test scenarios, run conversations, and evaluate results.

---

## Architecture Overview

```
agent_dev/
├── packages/shared/     @agent-dev/shared — domain types used by server and client
├── server/              @agent-dev/server — Hono API + WebSocket + job queue
└── client/              @agent-dev/client — Next.js 15 dashboard UI
```

**Stack decisions:**
- **Runtime**: TypeScript on Node.js — the agentic ecosystem has converged here
- **API**: Hono — lightweight, fast, native WebSocket support for streaming
- **Frontend**: Next.js 15 App Router + Tailwind CSS
- **LLM**: Vercel AI SDK (Phase 3) — unified interface over Anthropic + OpenAI
- **Database**: PostgreSQL + Drizzle ORM (Phase 2)
- **Queue**: BullMQ on Redis (Phase 2)

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 22 | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 9.15 | `npm i -g pnpm` |
| PostgreSQL | ≥ 16 | Phase 2 |
| Redis | ≥ 7 | Phase 2 |

---

## Phase 1 — Project Scaffold ✅

### What was built

#### Monorepo (`/`)
- `pnpm-workspace.yaml` — workspace members: `server/`, `client/`, `packages/*`
- `tsconfig.base.json` — strict TypeScript config shared by all packages
- `eslint.config.mjs` — ESLint flat config with TypeScript strict rules + Prettier
- `.prettierrc` — 2-space indent, trailing commas, 100-char print width

#### `packages/shared/`
Shared domain types consumed by both server and client. No runtime dependencies.

| File | Purpose |
|---|---|
| `src/types.ts` | Core interfaces: `AgentConfig`, `TestScenario`, `TestRun`, `ConversationTurn` |
| `src/index.ts` | Public exports |

Build: `pnpm --filter=shared build` → `dist/`

#### `server/`
Hono API server on Node.js.

| File | Purpose |
|---|---|
| `src/env.ts` | Zod-validated environment config via `dotenv-flow` |
| `src/app.ts` | Hono app — CORS, request logger, `/health` endpoint |
| `src/index.ts` | `@hono/node-server` entry, binds to `PORT` |

Environment loading priority (dotenv-flow): `.env.local` → `.env.test` → `.env`

Dev server: `tsx watch` (hot reload on save)  
Production build: `tsup` → `dist/index.js`

#### `client/`
Next.js 15 App Router with Tailwind CSS v4.

| File | Purpose |
|---|---|
| `.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3001` |
| `src/app/` | App Router pages (scaffolded by `create-next-app`) |

---

## Getting Started

### Install dependencies

```bash
cd agent_dev
pnpm install
```

### Start development servers

```bash
# Start both server (port 3001) and client (port 3000) in parallel
pnpm dev

# Or individually
pnpm --filter=server dev    # http://localhost:3001
pnpm --filter=client dev    # http://localhost:3000
```

### Verify server health

```bash
curl http://localhost:3001/health
# → {"status":"ok","timestamp":"..."}
```

### Build for production

```bash
pnpm build
```

### Type check all packages

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

### Format

```bash
pnpm format
```

---

## Environment Variables

### `server/.env.local` (local dev, not committed)

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3001` | No | Server port |
| `NODE_ENV` | `development` | No | Environment |
| `DATABASE_URL` | — | Phase 2 | PostgreSQL connection string |
| `REDIS_URL` | — | Phase 2 | Redis connection string |
| `ANTHROPIC_API_KEY` | — | Phase 3 | Anthropic API key |
| `OPENAI_API_KEY` | — | Phase 3 | OpenAI API key |

### `client/.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Server base URL |

---

## Implementation Phases

| Phase | Status | Description |
|---|---|---|
| **1 — Scaffold** | ✅ Done | Monorepo, Hono server, Next.js client, shared types |
| **2 — Data Layer** | 🔜 Next | PostgreSQL + Drizzle schema, Redis + Docker Compose |
| **3 — LLM Abstraction** | ⬜ Pending | Vercel AI SDK, multi-provider `LLMClient`, tool definitions |
| **4 — Conversation Engine** | ⬜ Pending | `ConversationLoop`, `TestSession`, turn-taking orchestrator |
| **5 — Queue System** | ⬜ Pending | BullMQ jobs, batch runs, retry logic |
| **6 — API Layer** | ⬜ Pending | REST routes, WebSocket streaming |
| **7 — Evaluation** | ⬜ Pending | Rule-based + LLM-as-judge evaluators |
| **8 — Auth & Multi-tenancy** | ⬜ Pending | Clerk, org-level isolation |
| **9 — Frontend** | ⬜ Pending | Agent builder, scenario builder, live conversation viewer |
