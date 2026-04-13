"use client";
import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import * as api from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Shared small components                                           */
/* ------------------------------------------------------------------ */

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

function ScoreBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400">—</span>;
  const color =
    value >= 70 ? "bg-green-500" : value >= 50 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 min-w-[60px]">
        <div
          className={`${color} h-1.5 rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">
        {value}
      </span>
    </div>
  );
}

function failureColor(rate: number): string {
  if (rate >= 60) return "#ef4444";
  if (rate >= 40) return "#f97316";
  if (rate >= 20) return "#eab308";
  return "#22c55e";
}

function heatCellBg(rate: number): string {
  if (rate >= 60) return "bg-red-500/80";
  if (rate >= 40) return "bg-orange-400/70";
  if (rate >= 20) return "bg-yellow-400/60";
  if (rate > 0) return "bg-green-400/50";
  return "bg-green-300/30";
}

/* ------------------------------------------------------------------ */
/*  Failure Breakdown (horizontal bar chart per tab)                  */
/* ------------------------------------------------------------------ */

type BreakdownTab = "personality" | "persona" | "dimension" | "agent";

function FailureBreakdownSection() {
  const [tab, setTab] = useState<BreakdownTab>("personality");
  const [showAll, setShowAll] = useState(false);

  const [byPersonality, setByPersonality] = useState<api.FailureBreakdown[]>([]);
  const [byPersona, setByPersona] = useState<api.FailureBreakdown[]>([]);
  const [byDimension, setByDimension] = useState<api.DimensionFailure[]>([]);
  const [byAgent, setByAgent] = useState<api.AgentFailure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.getFailuresByPersonality(),
      api.getFailuresByPersona(),
      api.getFailuresByDimension(),
      api.getFailuresByAgent(),
    ]).then(([p1, p2, p3, p4]) => {
      if (p1.status === "fulfilled") setByPersonality(p1.value);
      if (p2.status === "fulfilled") setByPersona(p2.value);
      if (p3.status === "fulfilled") setByDimension(p3.value);
      if (p4.status === "fulfilled") setByAgent(p4.value);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setShowAll(false);
  }, [tab]);

  const MAX_VISIBLE = 15;

  const chartData = useMemo(() => {
    let items: { name: string; failure_rate: number; failed: number; total: number }[] = [];

    if (tab === "personality") {
      items = byPersonality.map((r) => ({ name: r.name, failure_rate: r.failure_rate, failed: r.failed, total: r.total }));
    } else if (tab === "persona") {
      items = byPersona.map((r) => ({ name: r.name, failure_rate: r.failure_rate, failed: r.failed, total: r.total }));
    } else if (tab === "dimension") {
      items = byDimension.map((r) => ({
        name: `${r.dimension}: ${r.value}`,
        failure_rate: r.failure_rate,
        failed: r.failed,
        total: r.total,
      }));
    } else {
      items = byAgent.map((r) => ({ name: r.agent_name, failure_rate: r.failure_rate, failed: r.failed, total: r.total }));
    }

    items.sort((a, b) => b.failure_rate - a.failure_rate);
    return showAll ? items : items.slice(0, MAX_VISIBLE);
  }, [tab, byPersonality, byPersona, byDimension, byAgent, showAll]);

  const totalCount = tab === "personality" ? byPersonality.length
    : tab === "persona" ? byPersona.length
    : tab === "dimension" ? byDimension.length
    : byAgent.length;

  const TABS: { id: BreakdownTab; label: string }[] = [
    { id: "personality", label: "By Personality" },
    { id: "persona", label: "By Persona" },
    { id: "dimension", label: "By Dimension" },
    { id: "agent", label: "By Agent" },
  ];

  const barHeight = 32;
  const chartHeight = Math.max(120, chartData.length * barHeight + 40);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Failure Breakdown</h2>
        <p className="text-xs text-gray-400">What causes tests to fail the most (score &lt; 70)?</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">Loading...</div>
      ) : chartData.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-gray-400">
          No failure data available yet. Complete some test runs first.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                formatter={(value, _name, entry) => {
                  const p = entry?.payload as { failed?: number; total?: number } | undefined;
                  return [
                    `${value ?? 0}% (${p?.failed ?? 0}/${p?.total ?? 0})`,
                    "Failure Rate",
                  ];
                }}
              />
              <Bar dataKey="failure_rate" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={failureColor(entry.failure_rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {totalCount > MAX_VISIBLE && (
            <button
              onClick={() => setShowAll((p) => !p)}
              className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {showAll ? "Show less" : `Show all (${totalCount})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dimension Heatmap                                                 */
/* ------------------------------------------------------------------ */

function DimensionHeatmap() {
  const [cells, setCells] = useState<api.HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<api.HeatmapCell | null>(null);

  useEffect(() => {
    api.getFailuresHeatmap()
      .then(setCells)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { personalities, dimensions } = useMemo(() => {
    const pSet = new Set<string>();
    const dSet = new Set<string>();
    for (const c of cells) {
      pSet.add(c.personality);
      dSet.add(c.dimension);
    }
    return {
      personalities: Array.from(pSet).sort(),
      dimensions: Array.from(dSet).sort(),
    };
  }, [cells]);

  const cellMap = useMemo(() => {
    const m = new Map<string, api.HeatmapCell>();
    for (const c of cells) m.set(`${c.personality}||${c.dimension}`, c);
    return m;
  }, [cells]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Dimension Heatmap</h2>
        <div className="h-32 flex items-center justify-center text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (cells.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Dimension Heatmap</h2>
        <div className="h-24 flex items-center justify-center text-sm text-gray-400">
          No cross-tabulation data yet. Complete test runs with diverse question sets.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Dimension Heatmap</h2>
        <p className="text-xs text-gray-400">Personality profiles vs. dimensions — redder cells mean higher failure rate</p>
      </div>

      <div className="overflow-x-auto relative">
        <table className="text-[11px] border-collapse">
          <thead>
            <tr>
              <th className="text-left text-gray-400 font-medium p-2 min-w-[120px] sticky left-0 bg-white dark:bg-gray-900 z-10" />
              {dimensions.map((d) => (
                <th key={d} className="text-center text-gray-500 font-medium p-2 min-w-[80px] whitespace-nowrap">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personalities.map((p) => (
              <tr key={p}>
                <td className="text-gray-600 dark:text-gray-300 font-medium p-2 sticky left-0 bg-white dark:bg-gray-900 z-10 whitespace-nowrap">
                  {p}
                </td>
                {dimensions.map((d) => {
                  const cell = cellMap.get(`${p}||${d}`);
                  const rate = cell?.failure_rate ?? 0;
                  const hasData = !!cell;
                  return (
                    <td key={d} className="p-1">
                      <div
                        className={`relative rounded h-9 w-full flex items-center justify-center cursor-default transition-all ${
                          hasData ? heatCellBg(rate) : "bg-gray-100 dark:bg-gray-800"
                        }`}
                        onMouseEnter={() => cell && setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <span className={`text-[10px] font-semibold ${hasData ? "text-gray-900 dark:text-white" : "text-gray-300 dark:text-gray-600"}`}>
                          {hasData ? `${rate}%` : "—"}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {hoveredCell && (
          <div className="absolute top-2 right-2 bg-gray-900 text-white text-[11px] px-3 py-2 rounded-lg shadow-lg z-20 pointer-events-none">
            <div className="font-semibold">{hoveredCell.personality} × {hoveredCell.dimension}</div>
            <div className="mt-1">Failure rate: {hoveredCell.failure_rate}%</div>
            <div>Failed: {hoveredCell.failed} / {hoveredCell.total}</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
        <span>Low failure</span>
        <div className="flex gap-0.5">
          <div className="w-5 h-3 rounded-sm bg-green-300/30" />
          <div className="w-5 h-3 rounded-sm bg-green-400/50" />
          <div className="w-5 h-3 rounded-sm bg-yellow-400/60" />
          <div className="w-5 h-3 rounded-sm bg-orange-400/70" />
          <div className="w-5 h-3 rounded-sm bg-red-500/80" />
        </div>
        <span>High failure</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard page                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [summary, setSummary] = useState<api.DashboardSummary | null>(null);
  const [agents, setAgents] = useState<api.AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [trend, setTrend] = useState<api.AgentTrend | null>(null);
  const [weakQuestions, setWeakQuestions] = useState<api.WeakQuestion[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [loadingWeak, setLoadingWeak] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);

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
    let cancelled = false;
    (async () => {
      setLoadingTrend(true);
      try {
        const data = await api.getAgentTrend(selectedAgent, 20);
        if (!cancelled) { setTrend(data); setTrendError(null); }
      } catch {
        if (!cancelled) { setTrend(null); setTrendError("Failed to load trend data"); }
      } finally {
        if (!cancelled) setLoadingTrend(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedAgent]);

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto p-6 flex flex-col gap-8 bg-gray-50/80 dark:bg-gray-950/40">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Aggregate metrics &amp; failure analysis across all test runs
        </p>
      </div>

      {/* 1. Summary stat cards */}
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

      {/* 2. Score trend chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Score Trend
            </h2>
            <p className="text-xs text-gray-400">Last 20 completed runs for agent</p>
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
        ) : trendError ? (
          <div className="h-56 flex items-center justify-center text-sm text-red-500">
            {trendError}
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
                formatter={(value, name) => [
                  `${value ?? "—"}`,
                  String(name) === "avg_score" ? "Avg Score" : "Pass Rate %",
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
              ? "No completed runs yet. Run some tests to see trends."
              : "No completed runs for this agent yet."}
          </div>
        )}
      </div>

      {/* 3. Failure Breakdown tabs */}
      <FailureBreakdownSection />

      {/* 4. Dimension Heatmap */}
      <DimensionHeatmap />

      {/* 5. Weakest questions table (moved to bottom) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Weakest Questions
          </h2>
          <p className="text-xs text-gray-400">
            Questions with the lowest average score — drill down after identifying failure patterns above
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
