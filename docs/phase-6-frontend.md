# Phase 6 — Frontend (Next.js)

This document describes the frontend built in Phase 6: what was created, how it works, and how to run it.

---

## Overview

Phase 6 delivers the full browser UI for the Testing Agent platform. It is a **Next.js 15 App Router** application with **Tailwind CSS** and three main pages — one for each stage of the testing workflow.

```
client/
├── src/
│   ├── lib/
│   │   └── api.ts                  ← All API calls + TypeScript types
│   ├── components/
│   │   └── nav-links.tsx           ← Top nav with active-state highlighting
│   └── app/
│       ├── layout.tsx              ← Root layout: nav bar + page shell
│       ├── page.tsx                ← Redirects / → /connections
│       ├── connections/
│       │   └── page.tsx            ← Tab 1: Connection Test
│       ├── projects/
│       │   └── page.tsx            ← Tab 2: Context Gathering
│       └── runs/
│           └── page.tsx            ← Tab 3: Test Runner
└── .env.local                      ← NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## Running the Frontend

Make sure the backend is already running on port 8080:

```bash
# Terminal 1 — backend
conda activate v1_env
cd testing_agent/server
uvicorn main:app --reload --port 8080
```

Then start the frontend:

```bash
# Terminal 2 — frontend
cd testing_agent/client
pnpm install      # only needed first time
pnpm dev          # http://localhost:3000
```

The app opens at `http://localhost:3000` and redirects to `/connections`.

---

## Tab 1 — Connections (`/connections`)

**Purpose:** Connect to a Salesforce org, verify the connection, discover available agents, and manually chat with an agent.

### Layout

Two-panel layout:
- **Left sidebar** — list of saved Salesforce connections
- **Right panel** — connection detail, agents, and chat

### Workflow

1. Click **+ Add** to open the connection form
2. Fill in: Name, Domain, Consumer Key, Consumer Secret
3. Click **Save** — the connection is stored in the database
4. Select the connection from the left panel
5. Click **Test Connection** — verifies OAuth and reports how many agents are available
6. Click **Sync Agents** — fetches all agents from Salesforce and stores them
7. Click an agent pill to open the **chat panel**
8. Type a message and press Enter (or click Send) — creates a session and sends the message
9. The conversation continues in the chat window using the same session
10. Click **End Session** to close the active session

### What the backend does

| Action | API call |
|---|---|
| Save connection | `POST /api/connections` |
| Test connection | `POST /api/connections/{id}/test` |
| Sync agents | `POST /api/connections/{id}/agents/sync` |
| List agents | `GET /api/connections/{id}/agents` |
| Send message | `POST /api/agents/{id}/chat` |
| End session | `POST /api/agents/{id}/sessions/end` |

---

## Tab 2 — Projects (`/projects`)

**Purpose:** Create a test project with company context, then use GPT-4o to generate the testing material: personas, dimensions, personality profiles, and initiating questions.

### Layout

Two-panel layout:
- **Left sidebar** — list of projects
- **Right panel** — project details, generate controls, and tabbed view of generated data

### Workflow

1. Click **+ New** to create a project
2. Fill in: Project Name, Company Name, Industry, Competitors, Websites
3. Click **Save** — the project is stored
4. Select the project from the left panel
5. In the **Generate Context** section:
   - Select a **Connection** from the dropdown
   - Select an **Agent** from that connection
6. Click the generate buttons in order:
   - **Gen personas** — generates 4–6 user personas for the selected agent (requires agent)
   - **Gen dimensions** — generates question categories + values (e.g. General Info, Program Types, Products/Services)
   - **Gen profiles** — generates 6–10 tester personality profiles (e.g. Aggressive Tester, Friendly Tester)
   - **Gen questions** — generates 30 initiating questions per agent, combining personas + dimensions + profiles (requires all three above + agent)
7. View results in the tabs: **Personas | Dimensions | Profiles | Questions**

### Generation order matters

```
Personas  ──┐
Dimensions ─┼──► Questions
Profiles  ──┘
```

Questions require all three to exist before they can be generated.

### What the backend does

| Action | API call |
|---|---|
| Create project | `POST /api/projects` |
| Generate personas | `POST /api/projects/{id}/generate/personas` |
| Generate dimensions | `POST /api/projects/{id}/generate/dimensions` |
| Generate profiles | `POST /api/projects/{id}/generate/personality-profiles` |
| Generate questions | `POST /api/projects/{id}/generate/questions` |
| View personas | `GET /api/projects/{id}/personas` |
| View dimensions | `GET /api/projects/{id}/dimensions` |
| View profiles | `GET /api/projects/{id}/personality-profiles` |
| View questions | `GET /api/projects/{id}/questions` |

### What each generation produces

#### Personas
User archetypes who would interact with the agent. Each persona has:
- Name (e.g. "Frustrated Student", "First-Year Applicant")
- Description (1–2 sentences)
- Tag: `internal` (employee) or `external` (customer/public)

#### Dimensions
Question categories that cover the agent's domain. Always includes **Products / Services** plus 2 additional dimensions (e.g. General Info, Program Types). Each dimension has a list of specific values (e.g. "Campus Location", "Refund Policy").

#### Personality Profiles
Tester behavioural styles that determine how a question is phrased. Examples: Aggressive Tester, Detail-Oriented Tester, Confused First-Timer.

#### Initiating Questions
Test questions generated by combining one persona + one dimension value + one personality profile. Example:

> *"I'm trying to figure out if your school offers an online MBA. I've been looking everywhere and no one seems to know — can you just give me a straight answer?"*
> — **Frustrated Student** | Program Types / Online MBA | **Aggressive Tester**

---

## Tab 3 — Runs (`/runs`)

**Purpose:** Execute a set of initiating questions against a live Salesforce AgentForce agent, capture the full conversation transcript, and view pass/fail results.

### Layout

Two-panel layout:
- **Left sidebar** — run creation form + list of past runs
- **Right panel** — selected run status, progress bar, and per-question results

### Workflow

1. Select a **Project** (must have questions generated in Tab 2)
2. Select a **Connection** and **Agent** to run against
3. Click **Start Run** — creates a run record and starts execution in the background
4. The run appears in the left panel with a pulsing yellow dot while running
5. The right panel shows live progress (polls every 3 seconds)
6. When complete, the progress bar reaches 100% and results appear
7. Click any question row to expand it and see:
   - Initial response from the agent
   - Follow-up conversation turns (if the question wasn't fully answered)
   - Latency in milliseconds
   - Answered / Unanswered badge

### How a run works (under the hood)

For each initiating question:
1. Creates a new AgentForce session
2. Sends the initiating question
3. Calls the **Inspired Utterance** service (GPT-4o) to decide whether the question was answered
4. If not answered, generates a natural follow-up and sends it — up to 5 turns
5. Records the full transcript, latency, and answered status
6. Ends the session

### What the backend does

| Action | API call |
|---|---|
| Start run | `POST /api/runs` |
| Poll status | `GET /api/runs/{id}` |
| Get results | `GET /api/runs/{id}/results` |
| List past runs | `GET /api/runs` |

### Result badges

| Badge | Meaning |
|---|---|
| **Answered** (green) | GPT-4o judged the question fully answered within the conversation |
| **Unanswered** (amber) | Question was not resolved after up to 5 follow-up turns |
| **Failed** (red) | An API error occurred (session creation failure, Salesforce error, etc.) |

---

## API Client (`lib/api.ts`)

All communication with the backend goes through `client/src/lib/api.ts`. It exports typed functions for every endpoint:

```typescript
// Example usage in a page component
import * as api from "@/lib/api";

const connections = await api.listConnections();
const agents = await api.syncAgents(connectionId);
const run = await api.createRun({ project_id, agent_id });
```

All functions throw an `Error` with the backend's `detail` message on non-2xx responses, so errors can be caught and shown to the user with `alert(e.message)` or a toast.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |
| State management | React `useState` / `useEffect` (no external library) |
| Data fetching | Native `fetch` via `lib/api.ts` |
| Polling | `setInterval` with `clearInterval` on unmount |
| Font | Geist Sans + Geist Mono (Google Fonts) |

---

## Environment Variables

| Variable | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Backend base URL (dev) |

For production, update `.env.local` (or deployment environment) to point at the deployed API server.

---

## Common Issues

**Blank page / connection refused**
→ Make sure the backend is running: `uvicorn main:app --reload --port 8080`

**"Request failed" or CORS error in browser console**
→ Verify `NEXT_PUBLIC_API_URL` in `client/.env.local` matches the backend port

**Agents not showing after selecting a connection**
→ Click **Sync Agents** to fetch them from Salesforce first

**Generation takes a long time**
→ Expected — GPT-4o calls for dimensions and questions can take 15–30 seconds

**Run stays "pending" and never starts**
→ Check the backend terminal for errors — likely a missing `OPENAI_API_KEY` or Salesforce auth failure
