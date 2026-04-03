# Phase 12 — Dashboard & Analytics

## Overview

Phases 1–11 built the full test-execution and evaluation pipeline. Phase 12 adds a
**Dashboard** page that turns raw run data into actionable insights:

| Capability | What you see |
|---|---|
| Platform summary | Total runs, avg score, pass rate, agents & projects at a glance |
| Score trend | Line chart — avg score + pass rate across the last N runs for any agent |
| Weakest questions | Table of questions that consistently score lowest across all runs |

No new database tables are required — all data is derived from existing runs and results.

---

## Architecture

```
client/src/app/dashboard/page.tsx   ← new page
client/src/components/nav-links.tsx ← +Dashboard link
client/src/lib/api.ts               ← +3 API helper functions + interfaces

server/api/routes/dashboard.py      ← new router (3 GET endpoints)
server/main.py                      ← include dashboard_router
```

### New API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Platform-wide aggregate stats |
| `GET` | `/api/dashboard/agents/{agent_id}/trend?limit=20` | Per-agent score history |
| `GET` | `/api/dashboard/questions/weakest?project_id=&agent_id=&limit=15` | Lowest-scoring questions |

---

## Step 1 — Install Recharts (frontend only)

```bash
cd client
pnpm add recharts
```

---

## Step 2 — Backend: `server/api/routes/dashboard.py` (new file)

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from models.database import get_db
from models.tables import TestRun, TestRunResult, Agent

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    """Platform-wide aggregate statistics."""
    run_stats = await db.execute(
        select(
            func.count(TestRun.id).label("total_runs"),
            func.count(
                case((TestRun.status == "completed", TestRun.id))
            ).label("completed_runs"),
        )
    )
    row = run_stats.one()

    result_stats = await db.execute(
        select(
            func.count(TestRunResult.id).label("total_questions"),
            func.avg(TestRunResult.score).label("avg_score"),
            func.count(
                case((TestRunResult.score >= 70, TestRunResult.id))
            ).label("pass_count"),
            func.count(
                case((TestRunResult.score.isnot(None), TestRunResult.id))
            ).label("scored_count"),
        ).where(TestRunResult.status == "completed")
    )
    res = result_stats.one()

    agent_count = await db.scalar(
        select(func.count(func.distinct(TestRun.agent_id)))
    )
    project_count = await db.scalar(
        select(func.count(func.distinct(TestRun.project_id)))
    )

    avg_score = round(float(res.avg_score), 1) if res.avg_score is not None else None
    pass_rate = (
        round(res.pass_count / res.scored_count * 100, 1)
        if res.scored_count and res.scored_count > 0
        else None
    )

    return {
        "total_runs": row.total_runs,
        "completed_runs": row.completed_runs,
        "total_questions_tested": res.total_questions or 0,
        "overall_avg_score": avg_score,
        "overall_pass_rate": pass_rate,
        "agents_count": agent_count or 0,
        "projects_count": project_count or 0,
    }


@router.get("/agents")
async def list_agents_with_runs(db: AsyncSession = Depends(get_db)):
    """Return agents that have at least one completed run."""
    result = await db.execute(
        select(Agent.id, Agent.name)
        .join(TestRun, TestRun.agent_id == Agent.id)
        .where(TestRun.status == "completed")
        .distinct()
        .order_by(Agent.name)
    )
    return [{"id": r.id, "name": r.name} for r in result.all()]


@router.get("/agents/{agent_id}/trend")
async def get_agent_trend(
    agent_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Score + pass-rate trend for the last `limit` completed runs of an agent."""
    agent = await db.get(Agent, agent_id)
    if not agent:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Agent not found")

    runs_result = await db.execute(
        select(TestRun)
        .where(TestRun.agent_id == agent_id, TestRun.status == "completed")
        .order_by(TestRun.completed_at.desc())
        .limit(limit)
    )
    runs = runs_result.scalars().all()
    runs = list(reversed(runs))  # oldest first for chart

    trend = []
    for run in runs:
        stats = await db.execute(
            select(
                func.avg(TestRunResult.score).label("avg_score"),
                func.count(TestRunResult.id).label("total"),
                func.count(
                    case((TestRunResult.score >= 70, TestRunResult.id))
                ).label("passed"),
            ).where(
                TestRunResult.run_id == run.id,
                TestRunResult.status == "completed",
                TestRunResult.score.isnot(None),
            )
        )
        s = stats.one()
        avg = round(float(s.avg_score), 1) if s.avg_score is not None else None
        pass_rate = (
            round(s.passed / s.total * 100, 1) if s.total and s.total > 0 else None
        )
        trend.append({
            "run_id": run.id,
            "run_short": run.id[:8],
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "avg_score": avg,
            "pass_rate": pass_rate,
            "completed_questions": run.completed_questions,
        })

    return {"agent_id": agent_id, "agent_name": agent.name, "runs": trend}


@router.get("/questions/weakest")
async def get_weakest_questions(
    project_id: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    limit: int = Query(default=15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Questions that consistently score lowest across completed runs."""
    query = (
        select(
            TestRunResult.question_text,
            func.avg(TestRunResult.score).label("avg_score"),
            func.min(TestRunResult.score).label("min_score"),
            func.max(TestRunResult.score).label("max_score"),
            func.count(TestRunResult.id).label("run_count"),
            func.count(
                case((TestRunResult.score >= 70, TestRunResult.id))
            ).label("pass_count"),
        )
        .join(TestRun, TestRunResult.run_id == TestRun.id)
        .where(
            TestRunResult.status == "completed",
            TestRunResult.score.isnot(None),
        )
    )
    if project_id:
        query = query.where(TestRun.project_id == project_id)
    if agent_id:
        query = query.where(TestRun.agent_id == agent_id)

    query = (
        query.group_by(TestRunResult.question_text)
        .having(func.count(TestRunResult.id) >= 1)
        .order_by(func.avg(TestRunResult.score).asc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "question_text": r.question_text,
            "avg_score": round(float(r.avg_score), 1) if r.avg_score is not None else None,
            "min_score": r.min_score,
            "max_score": r.max_score,
            "run_count": r.run_count,
            "pass_rate": round(r.pass_count / r.run_count * 100, 1) if r.run_count else None,
        }
        for r in rows
    ]
```

---

## Step 3 — Register the router in `server/main.py`

**Change** — add 2 lines (import + include):

```python
# After: from api.routes.reports import router as reports_router
from api.routes.dashboard import router as dashboard_router   # ← ADD

# After: app.include_router(reports_router, dependencies=_auth)
app.include_router(dashboard_router, dependencies=_auth)       # ← ADD
```

Full updated file for reference:

```python
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api.middleware.auth import verify_api_key
from api.services.llm.factory import llm_config
from api.routes.auth import router as auth_router
from api.routes.connections import router as connections_router
from api.routes.agents import router as agents_router
from api.routes.projects import router as projects_router
from api.routes.generate import router as generate_router
from api.routes.runs import router as runs_router
from api.routes.reports import router as reports_router
from api.routes.dashboard import router as dashboard_router   # NEW

app = FastAPI(
    title="Testing Agent API",
    version="0.1.0",
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

_auth = [Depends(verify_api_key)]
app.include_router(connections_router, dependencies=_auth)
app.include_router(agents_router, dependencies=_auth)
app.include_router(projects_router, dependencies=_auth)
app.include_router(generate_router, dependencies=_auth)
app.include_router(runs_router, dependencies=_auth)
app.include_router(reports_router, dependencies=_auth)
app.include_router(dashboard_router, dependencies=_auth)      # NEW


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV}


@app.get("/api/config")
async def get_config(_: str = Depends(verify_api_key)):
    return llm_config()
```

---

## Step 4 — Frontend API helpers in `client/src/lib/api.ts`

Add these interfaces and functions at the **bottom** of the file (after `ApiKeyCreated`):

```typescript
// ── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_runs: number;
  completed_runs: number;
  total_questions_tested: number;
  overall_avg_score: number | null;
  overall_pass_rate: number | null;
  agents_count: number;
  projects_count: number;
}

export interface AgentOption {
  id: string;
  name: string;
}

export interface TrendPoint {
  run_id: string;
  run_short: string;
  completed_at: string | null;
  avg_score: number | null;
  pass_rate: number | null;
  completed_questions: number;
}

export interface AgentTrend {
  agent_id: string;
  agent_name: string;
  runs: TrendPoint[];
}

export interface WeakQuestion {
  question_text: string;
  avg_score: number | null;
  min_score: number | null;
  max_score: number | null;
  run_count: number;
  pass_rate: number | null;
}

export const getDashboardSummary = () =>
  req<DashboardSummary>("/api/dashboard/summary");

export const getDashboardAgents = () =>
  req<AgentOption[]>("/api/dashboard/agents");

export const getAgentTrend = (agentId: string, limit = 20) =>
  req<AgentTrend>(`/api/dashboard/agents/${agentId}/trend?limit=${limit}`);

export const getWeakestQuestions = (params?: {
  project_id?: string;
  agent_id?: string;
  limit?: number;
}) => {
  const p = new URLSearchParams();
  if (params?.project_id) p.set("project_id", params.project_id);
  if (params?.agent_id) p.set("agent_id", params.agent_id);
  if (params?.limit) p.set("limit", String(params.limit));
  return req<WeakQuestion[]>(`/api/dashboard/questions/weakest?${p}`);
};
```

---

## Step 5 — Add "Dashboard" to navigation: `client/src/components/nav-links.tsx`

```typescript
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },   // ← ADD (first)
  { href: "/connections", label: "Connections" },
  { href: "/projects", label: "Projects" },
  { href: "/runs", label: "Runs" },
  { href: "/settings", label: "Settings" },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

---

## Step 6 — Create `client/src/app/dashboard/page.tsx` (new file)

```tsx
"use client";
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as api from "@/lib/api";

function StatCard({
  label,
  value,
  sub,
  color = "indigo",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "indigo" | "green" | "amber" | "rose";
}) {
  const ring: Record<string, string> = {
    indigo: "border-indigo-200 dark:border-indigo-800",
    green: "border-green-200 dark:border-green-800",
    amber: "border-amber-200 dark:border-amber-800",
    rose: "border-rose-200 dark:border-rose-800",
  };
  const text: Record<string, string> = {
    indigo: "text-indigo-600 dark:text-indigo-400",
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
  };
  return (
    <div
      className={`flex-1 min-w-[140px] bg-white dark:bg-gray-900 border ${ring[color]} rounded-xl p-4 flex flex-col gap-1`}
    >
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-3xl font-bold ${text[color]}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

function ScoreBar({ value, max = 100 }: { value: number | null; max?: number }) {
  if (value === null) return <span className="text-xs text-gray-400">—</span>;
  const pct = (value / max) * 100;
  const color =
    value >= 70
      ? "bg-green-500"
      : value >= 50
      ? "bg-yellow-400"
      : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 min-w-[60px]">
        <div
          className={`${color} h-1.5 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">
        {value}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<api.DashboardSummary | null>(null);
  const [agents, setAgents] = useState<api.AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [trend, setTrend] = useState<api.AgentTrend | null>(null);
  const [weakQuestions, setWeakQuestions] = useState<api.WeakQuestion[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [loadingWeak, setLoadingWeak] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.getDashboardSummary(),
      api.getDashboardAgents(),
      api.getWeakestQuestions({ limit: 15 }),
    ]).then(([s, a, w]) => {
      if (s.status === "fulfilled") setSummary(s.value);
      if (a.status === "fulfilled") {
        setAgents(a.value);
        if (a.value.length > 0) setSelectedAgent(a.value[0].id);
      }
      if (w.status === "fulfilled") setWeakQuestions(w.value);
      setLoadingWeak(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedAgent) return;
    setLoadingTrend(true);
    setTrend(null);
    api
      .getAgentTrend(selectedAgent, 20)
      .then(setTrend)
      .catch(() => setError("Failed to load trend"))
      .finally(() => setLoadingTrend(false));
  }, [selectedAgent]);

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Aggregate metrics across all test runs
        </p>
      </div>

      {/* Summary cards */}
      {summary ? (
        <div className="flex flex-wrap gap-3">
          <StatCard
            label="Completed Runs"
            value={summary.completed_runs}
            sub={`${summary.total_runs} total`}
            color="indigo"
          />
          <StatCard
            label="Avg Score"
            value={summary.overall_avg_score !== null ? summary.overall_avg_score : "—"}
            sub="across all runs"
            color={
              summary.overall_avg_score === null
                ? "indigo"
                : summary.overall_avg_score >= 70
                ? "green"
                : summary.overall_avg_score >= 50
                ? "amber"
                : "rose"
            }
          />
          <StatCard
            label="Pass Rate"
            value={
              summary.overall_pass_rate !== null
                ? `${summary.overall_pass_rate}%`
                : "—"
            }
            sub="score ≥ 70"
            color={
              summary.overall_pass_rate === null
                ? "indigo"
                : summary.overall_pass_rate >= 70
                ? "green"
                : summary.overall_pass_rate >= 50
                ? "amber"
                : "rose"
            }
          />
          <StatCard
            label="Questions Tested"
            value={summary.total_questions_tested}
            sub={`${summary.agents_count} agents · ${summary.projects_count} projects`}
            color="indigo"
          />
        </div>
      ) : (
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 min-w-[140px] h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Score trend */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Score Trend
            </h2>
            <p className="text-xs text-gray-400">Last 20 completed runs</p>
          </div>
          {agents.length > 0 && (
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {loadingTrend ? (
          <div className="h-56 flex items-center justify-center text-sm text-gray-400">
            Loading...
          </div>
        ) : trend && trend.runs.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trend.runs}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="run_short"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
                formatter={(val: number, name: string) => [
                  `${val}`,
                  name === "avg_score" ? "Avg Score" : "Pass Rate %",
                ]}
                labelFormatter={(label) => `Run ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(val) =>
                  val === "avg_score" ? "Avg Score" : "Pass Rate %"
                }
              />
              <Line
                type="monotone"
                dataKey="avg_score"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="pass_rate"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-56 flex items-center justify-center text-sm text-gray-400">
            {agents.length === 0
              ? "No completed runs found. Run some tests first."
              : "No data for this agent yet."}
          </div>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* Weakest questions */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Weakest Questions
          </h2>
          <p className="text-xs text-gray-400">
            Questions with the lowest average score across all runs (min 1 run)
          </p>
        </div>

        {loadingWeak ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"
              />
            ))}
          </div>
        ) : weakQuestions.length === 0 ? (
          <p className="text-sm text-gray-400">
            No scored questions yet. Complete some runs first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left text-gray-400 font-medium py-2 pr-4">
                    Question
                  </th>
                  <th className="text-left text-gray-400 font-medium py-2 px-3 whitespace-nowrap w-36">
                    Avg Score
                  </th>
                  <th className="text-center text-gray-400 font-medium py-2 px-3 whitespace-nowrap">
                    Runs
                  </th>
                  <th className="text-center text-gray-400 font-medium py-2 px-3 whitespace-nowrap">
                    Pass Rate
                  </th>
                  <th className="text-center text-gray-400 font-medium py-2 pl-3 whitespace-nowrap">
                    Range
                  </th>
                </tr>
              </thead>
              <tbody>
                {weakQuestions.map((q, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300 leading-snug max-w-xs">
                      {q.question_text}
                    </td>
                    <td className="py-2.5 px-3 w-36">
                      <ScoreBar value={q.avg_score} />
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-500">
                      {q.run_count}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {q.pass_rate !== null ? (
                        <span
                          className={`font-semibold ${
                            q.pass_rate >= 70
                              ? "text-green-600 dark:text-green-400"
                              : q.pass_rate >= 50
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-500 dark:text-red-400"
                          }`}
                        >
                          {q.pass_rate}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-center text-gray-400 whitespace-nowrap">
                      {q.min_score ?? "—"} – {q.max_score ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Execution Steps

### 1. Install Recharts

```bash
cd /Users/grividi/agents_dev/testing_agent/client
pnpm add recharts
```

### 2. Create the backend dashboard route

Create the file:
```
server/api/routes/dashboard.py
```
Paste the full content from **Step 2** above.

### 3. Register in `server/main.py`

Add the two lines from **Step 3** — import and `app.include_router`.

### 4. Add API helpers to `client/src/lib/api.ts`

Append the interfaces and functions from **Step 4** at the bottom of the file.

### 5. Update navigation: `client/src/components/nav-links.tsx`

Replace the `LINKS` array with the version in **Step 5** (Dashboard first).

### 6. Create the dashboard page

Create the file:
```
client/src/app/dashboard/page.tsx
```
Paste the full TSX from **Step 6** above.

### 7. Restart the backend

```bash
cd /Users/grividi/agents_dev/testing_agent/server
source .venv/bin/activate   # or conda activate v1_env
uvicorn main:app --reload --port 8080
```

No new migrations are needed — Phase 12 reads from existing tables only.

### 8. Verify in browser

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

| What to check | Expected |
|---|---|
| 4 summary stat cards show | Total runs, Avg Score, Pass Rate, Questions Tested |
| Agent dropdown populated | Shows agents that have completed runs |
| Score trend chart renders | Line chart with Avg Score (solid) + Pass Rate % (dashed) |
| Weakest questions table | Questions ordered by avg score ascending |

---

## What changes and what does not

| File | Change type |
|---|---|
| `server/api/routes/dashboard.py` | **New file** |
| `server/main.py` | +2 lines (import + include_router) |
| `client/src/lib/api.ts` | +7 interfaces + 4 functions appended |
| `client/src/components/nav-links.tsx` | Dashboard link added to LINKS array |
| `client/src/app/dashboard/page.tsx` | **New file** |
| Database / migrations | **None** — read-only analytics from existing tables |
