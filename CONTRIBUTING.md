# Contributing to Testing Agent

Welcome to the team! This guide gets you from zero to a running dev environment in under 10 minutes.

---

## What is this project?

A platform for testing AI agents against each other. You define agent configurations (system prompt, model, tools), pair them into test scenarios, run conversations, and evaluate the results.

The codebase is a **monorepo** — one repository that contains multiple related packages that share code and tooling.

---

## What is a Monorepo?

Instead of three separate repositories (backend, frontend, shared library), everything lives in one place:

```
testing_agent/
├── server/          ← Backend API (Node.js)
├── client/          ← Frontend UI (Next.js)
└── packages/
    └── shared/      ← Types and utilities used by both server and client
```

**Why?**
- Change a shared type once — both server and client see it immediately
- One `git clone` gets you everything
- One command starts the whole stack

---

## What is pnpm?

`pnpm` is a package manager (like `npm` or `yarn`) that is faster and uses less disk space by sharing packages between projects.

**You only need to know 4 commands:**

| Command | What it does |
|---|---|
| `pnpm install` | Install all dependencies (run once after cloning) |
| `pnpm dev` | Start the full dev stack (server + client) |
| `pnpm build` | Build everything for production |
| `pnpm lint` | Check code quality |

If you've used `npm install` and `npm run dev` before, pnpm works exactly the same way — just replace `npm` with `pnpm`.

---

## First-Time Setup

### 1. Install Node.js (if you don't have it)

Download and install Node.js 22 or later from [nodejs.org](https://nodejs.org).

Verify:
```bash
node --version   # should print v22.x.x or higher
```

### 2. Install pnpm (if you don't have it)

```bash
npm install -g pnpm
```

Verify:
```bash
pnpm --version   # should print 9.x.x or higher
```

### 3. Clone the repository

```bash
git clone https://github.com/TribusPoint/testing_agent.git
cd testing_agent
```

### 4. Install dependencies

```bash
pnpm install
```

This installs everything for all packages in one command. You do not need to `cd` into each folder separately.

### 5. Set up your environment variables

```bash
cp server/.env.local.example server/.env.local
```

Open `server/.env.local` and fill in the values your team lead provides (API keys, database URL, etc.). The file looks like this:

```
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
DATABASE_URL=postgresql://...
```

### 6. Start the development servers

```bash
pnpm dev
```

This starts:
- **Backend API** at [http://localhost:3001](http://localhost:3001)
- **Frontend UI** at [http://localhost:3000](http://localhost:3000)

Verify the backend is running:
```bash
curl http://localhost:3001/health
# → {"status":"ok","timestamp":"..."}
```

---

## Day-to-Day Development

### Working on the backend (`server/`)

The server uses **Hono** (a lightweight web framework) on Node.js with TypeScript.

```bash
# Start only the server with hot reload
pnpm --filter=server dev
```

Files you'll work with:
- `server/src/app.ts` — add new API routes here
- `server/src/env.ts` — add new environment variables here

### Working on the frontend (`client/`)

The client uses **Next.js 15** with the App Router and **Tailwind CSS**.

```bash
# Start only the client
pnpm --filter=client dev
```

Files you'll work with:
- `client/src/app/` — pages (each folder = a URL route)
- `client/src/components/` — reusable UI components (create this as needed)

### Working on shared types (`packages/shared/`)

Shared TypeScript interfaces used by both server and client.

```bash
# Build shared types (required if you change them)
pnpm --filter=shared build
```

When you add or change a type in `packages/shared/src/types.ts`, both the server and client immediately see the change — no copying needed.

---

## Project Structure Explained

```
testing_agent/
│
├── package.json              ← Workspace root — shared dev tools (ESLint, Prettier, TypeScript)
├── pnpm-workspace.yaml       ← Tells pnpm which folders are packages
├── tsconfig.base.json        ← TypeScript settings inherited by all packages
│
├── packages/
│   └── shared/               ← @testing-agent/shared
│       └── src/
│           └── types.ts      ← AgentConfig, TestScenario, TestRun, ConversationTurn
│
├── server/                   ← @testing-agent/server
│   ├── src/
│   │   ├── index.ts          ← Entry point — starts the HTTP server
│   │   ├── app.ts            ← Hono app — routes and middleware
│   │   └── env.ts            ← Environment variable validation
│   ├── .env                  ← Default env values (committed, no secrets)
│   └── .env.local            ← Your local secrets (NOT committed, in .gitignore)
│
└── client/                   ← @testing-agent/client
    ├── src/
    │   └── app/              ← Next.js App Router pages
    └── .env.local            ← Client env (API URL etc.)
```

---

## Common Issues

**`pnpm: command not found`**
→ Run `npm install -g pnpm` first.

**`Cannot find module '@testing-agent/shared'`**
→ Run `pnpm --filter=shared build` to compile the shared package.

**Port 3000 or 3001 already in use**
→ Run `lsof -ti:3001 | xargs kill` to free the port.

**Environment variable errors on server start**
→ Make sure you copied and filled in `server/.env.local` (step 5 above).

---

## Tech Stack Reference

| Layer | Technology | Why |
|---|---|---|
| Language | TypeScript | Type safety across the full stack |
| Package manager | pnpm | Faster installs, monorepo support |
| Backend | Hono + Node.js | Lightweight, fast, WebSocket support |
| Frontend | Next.js 15 + Tailwind CSS | App Router, React Server Components |
| Shared types | `packages/shared` | One source of truth for data models |
| LLM providers | Anthropic + OpenAI (Phase 3) | Via Vercel AI SDK |
| Database | PostgreSQL + Drizzle ORM (Phase 2) | Strong relational modeling |
| Job queue | BullMQ + Redis (Phase 2) | Long-running agent conversations |

---

## Questions?

Reach out to the team lead or open a GitHub issue.
