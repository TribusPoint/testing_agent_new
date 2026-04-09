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
          Aggregate metrics across all test runs
        </p>
      </div>

      {/* Summary stat cards */}
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

      {/* Score trend chart */}
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

      {/* Weakest questions table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Weakest Questions
          </h2>
          <p className="text-xs text-gray-400">
            Questions with the lowest average score across all completed runs
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
