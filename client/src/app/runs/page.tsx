"use client";
import { useState, useEffect, useRef } from "react";
import * as api from "@/lib/api";

const SELECT_CLS =
  "w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50";

function statusDot(s: string) {
  if (s === "completed") return "bg-green-500";
  if (s === "failed") return "bg-red-500";
  if (s === "cancelled") return "bg-orange-400";
  if (s === "running") return "bg-yellow-400 animate-pulse";
  if (s === "cancelling") return "bg-orange-400 animate-pulse";
  return "bg-gray-300 dark:bg-gray-600";
}

function statusColor(s: string) {
  if (s === "completed") return "text-green-600 dark:text-green-400";
  if (s === "failed") return "text-red-500 dark:text-red-400";
  if (s === "cancelled") return "text-orange-500 dark:text-orange-400";
  if (s === "running") return "text-yellow-500 dark:text-yellow-400";
  if (s === "cancelling") return "text-orange-400 dark:text-orange-300";
  return "text-gray-400";
}

function ScoreBadge({ score, variant = "ai" }: { score: number | null; variant?: "ai" | "human" }) {
  if (score === null) return null;
  const color =
    score >= 70
      ? variant === "human"
        ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
        : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
      : score >= 50
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${color}`}>
      {variant === "human" ? "H:" : "AI:"}{score}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 min-w-[90px]">
      <span className="text-lg font-bold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-400 mt-0.5 text-center">{label}</span>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-xs text-gray-400">—</span>;
  const color = delta > 0 ? "text-green-600 dark:text-green-400" : delta < 0 ? "text-red-500 dark:text-red-400" : "text-gray-400";
  return <span className={`text-xs font-semibold ${color}`}>{delta > 0 ? "+" : ""}{delta}</span>;
}

export default function RunsPage() {
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [connections, setConnections] = useState<api.Connection[]>([]);
  const [connAgents, setConnAgents] = useState<api.Agent[]>([]);

  const [runProjectId, setRunProjectId] = useState("");
  const [connId, setConnId] = useState("");
  const [runAgentId, setRunAgentId] = useState("");

  const [runs, setRuns] = useState<api.Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<api.Run | null>(null);
  const [results, setResults] = useState<api.RunResult[]>([]);
  const [report, setReport] = useState<api.RunReport | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const [cancellingRun, setCancellingRun] = useState<string | null>(null);
  const [showStartRun, setShowStartRun] = useState(false);

  // Annotation state
  const [annotating, setAnnotating] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState<{ human_score: string; human_notes: string }>({ human_score: "", human_notes: "" });
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Compare state
  const [showCompare, setShowCompare] = useState(false);
  const [compareRunId, setCompareRunId] = useState("");
  const [comparison, setComparison] = useState<api.RunComparison | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  const streamRef = useRef<AbortController | null>(null);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.abort();
      streamRef.current = null;
    }
  }

  function clearRunSelection() {
    stopStream();
    setSelectedRun(null);
    setResults([]);
    setReport(null);
    setExpanded(null);
    setAnnotating(null);
    setShowCompare(false);
    setComparison(null);
  }

  useEffect(() => {
    Promise.allSettled([api.listProjects(), api.listConnections(), api.listRuns()]).then(
      ([p, c, r]) => {
        if (p.status === "fulfilled") setProjects(p.value);
        if (c.status === "fulfilled") setConnections(c.value);
        if (r.status === "fulfilled") setRuns(r.value);
      }
    );
    return () => stopStream();
  }, []);

  useEffect(() => {
    if (!connId) {
      setConnAgents([]);
      setRunAgentId("");
      return;
    }
    api.listAgents(connId).then(setConnAgents).catch(() => setConnAgents([]));
    setRunAgentId("");
  }, [connId]);

  useEffect(() => {
    if (!runAgentId) {
      clearRunSelection();
      return;
    }
    if (selectedRun != null && selectedRun.agent_id !== runAgentId) {
      clearRunSelection();
    }
  }, [runAgentId, selectedRun?.id, selectedRun?.agent_id]);

  async function handleDeleteRun(runId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!confirm("Delete this run and all its results?")) return;
    setDeletingRun(runId);
    try {
      await api.deleteRun(runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      if (selectedRun?.id === runId) {
        clearRunSelection();
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally { setDeletingRun(null); }
  }

  async function handleCancelRun(runId: string) {
    if (!confirm("Cancel this run? It will stop after the current question finishes.")) return;
    setCancellingRun(runId);
    try {
      await api.cancelRun(runId);
      setRuns((prev) => prev.map((r) => r.id === runId ? { ...r, status: "cancelling" } : r));
      setSelectedRun((prev) => prev?.id === runId ? { ...prev, status: "cancelling" } : prev);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Cancel failed");
    } finally { setCancellingRun(null); }
  }

  async function handleCreateRun(): Promise<boolean> {
    if (!connId || !runProjectId || !runAgentId) {
      alert("Select a connection, agent, and project (open Start run to pick the project).");
      return false;
    }
    setCreating(true);
    try {
      const run = await api.createRun({ project_id: runProjectId, agent_id: runAgentId });
      setRuns((prev) => [run, ...prev]);
      await selectRun(run);
      return true;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to start run");
      return false;
    } finally {
      setCreating(false);
    }
  }

  function startStreaming(runId: string) {
    stopStream();
    const controller = new AbortController();
    streamRef.current = controller;

    async function consume() {
      try {
        const url = api.streamRunUrl(runId);
        const key = api.getStoredKey();
        const res = await fetch(url, {
          signal: controller.signal,
          headers: key ? { "X-API-Key": key } : {},
        });
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const raw = line.slice(6).trim();
              if (raw && raw !== "{}") {
                try {
                  const event = JSON.parse(raw);
                  handleStreamEvent(eventType, event, runId);
                } catch {}
              }
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          // SSE disconnected — fall back to single refresh
          try {
            const updated = await api.getRun(runId);
            setRuns((prev) => prev.map((r) => (r.id === runId ? updated : r)));
            setSelectedRun((prev) => (prev?.id === runId ? updated : prev));
          } catch {}
        }
      }
    }

    consume();
  }

  function handleStreamEvent(type: string, event: Record<string, unknown>, runId: string) {
    if (type === "run_started") {
      setRuns((prev) =>
        prev.map((r) => r.id === runId ? { ...r, status: "running", total_questions: event.total_questions as number } : r)
      );
      setSelectedRun((prev) => prev?.id === runId ? { ...prev, status: "running" } : prev);
    } else if (type === "result_update") {
      const ev = event as { result_id: string; status: string; question_text?: string; score?: number; latency_ms?: number; answered?: boolean; response_text?: string; evaluation_notes?: string; follow_up_count?: number; completed_questions?: number; total_questions?: number; error?: string };
      setResults((prev) => {
        const idx = prev.findIndex((r) => r.id === ev.result_id);
        if (idx >= 0) {
          // Merge updates into existing row
          const updated = { ...prev[idx], status: ev.status };
          if (ev.score !== undefined) updated.score = ev.score;
          if (ev.latency_ms !== undefined) updated.latency_ms = ev.latency_ms;
          if (ev.answered !== undefined) updated.answered = ev.answered;
          if (ev.response_text !== undefined) updated.response_text = ev.response_text;
          if (ev.evaluation_notes !== undefined) updated.evaluation_notes = ev.evaluation_notes;
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        // New result row not yet in state — add it
        return [
          ...prev,
          {
            id: ev.result_id,
            run_id: runId,
            question_id: null,
            question_text: ev.question_text ?? "",
            status: ev.status,
            response_text: null,
            follow_up_utterances: [],
            latency_ms: null,
            answered: null,
            score: null,
            evaluation_notes: null,
            human_score: null,
            human_notes: null,
          } as api.RunResult,
        ];
      });
      if (ev.completed_questions !== undefined) {
        setRuns((prev) => prev.map((r) => r.id === runId ? { ...r, completed_questions: ev.completed_questions as number, total_questions: ev.total_questions as number } : r));
        setSelectedRun((prev) => prev?.id === runId ? { ...prev, completed_questions: ev.completed_questions as number } : prev);
      }
    } else if (type === "run_complete" || type === "run_failed") {
      const finalStatus = type === "run_failed" ? "failed" : ((event.status as string) ?? "completed");
      setRuns((prev) => prev.map((r) => r.id === runId ? { ...r, status: finalStatus } : r));
      setSelectedRun((prev) => prev?.id === runId ? { ...prev, status: finalStatus } : prev);
      stopStream();
      // Fetch final results and report
      Promise.allSettled([api.listRunResults(runId), api.getRunReport(runId)]).then(([res, rep]) => {
        if (res.status === "fulfilled") setResults(res.value);
        if (rep.status === "fulfilled") setReport(rep.value);
      });
    }
  }

  async function selectRun(run: api.Run) {
    setSelectedRun(run);
    setResults([]);
    setReport(null);
    setExpanded(null);
    setAnnotating(null);
    setShowCompare(false);
    setComparison(null);
    if (run.status === "completed" || run.status === "failed") {
      setLoadingResults(true);
      try {
        const [res, rep] = await Promise.allSettled([
          api.listRunResults(run.id),
          api.getRunReport(run.id),
        ]);
        if (res.status === "fulfilled") setResults(res.value);
        if (rep.status === "fulfilled") setReport(rep.value);
      } finally { setLoadingResults(false); }
    } else if (run.status === "running" || run.status === "pending" || run.status === "cancelling") {
      // Load existing result rows so questions already in DB are visible immediately
      setLoadingResults(true);
      api.listRunResults(run.id)
        .then(setResults)
        .catch(() => {})
        .finally(() => setLoadingResults(false));
      startStreaming(run.id);
    }
  }

  async function saveAnnotation(resultId: string) {
    if (!selectedRun) return;
    setSavingAnnotation(true);
    try {
      const score = annotationDraft.human_score === "" ? null : parseInt(annotationDraft.human_score);
      await api.annotateResult(selectedRun.id, resultId, {
        human_score: score,
        human_notes: annotationDraft.human_notes.trim() || null,
      });
      setResults((prev) => prev.map((r) =>
        r.id === resultId
          ? { ...r, human_score: score, human_notes: annotationDraft.human_notes.trim() || null }
          : r
      ));
      setAnnotating(null);
    } catch {}
    finally { setSavingAnnotation(false); }
  }

  async function handleCompare() {
    if (!selectedRun || !compareRunId) return;
    setLoadingCompare(true);
    try {
      const c = await api.compareRuns(selectedRun.id, compareRunId);
      setComparison(c);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Compare failed");
    } finally { setLoadingCompare(false); }
  }

  const pct = selectedRun && selectedRun.total_questions > 0
    ? Math.round((selectedRun.completed_questions / selectedRun.total_questions) * 100)
    : 0;

  const otherRuns = runs.filter((r) => r.id !== selectedRun?.id);

  const sortedConnections = [...connections].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const filteredRuns = runAgentId ? runs.filter((r) => r.agent_id === runAgentId) : [];

  const sortedFilteredRuns = [...filteredRuns].sort((a, b) => {
    const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
    const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50/80 dark:bg-gray-950/40">
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 sm:px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label htmlFor="runs-conn-select" className="text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0">
            Connection
          </label>
          <select
            id="runs-conn-select"
            className={`${SELECT_CLS} flex-1 min-w-[9rem] sm:min-w-[11rem] max-w-xs`}
            value={connId}
            onChange={(e) => setConnId(e.target.value)}
          >
            <option value="">{connections.length === 0 ? "No connections" : "Choose connection…"}</option>
            {sortedConnections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.connection_type === "http" ? "🌐 " : c.connection_type === "browser" ? "🤖 " : "⚡ "}
                {c.name}
              </option>
            ))}
          </select>

          <label htmlFor="runs-agent-select" className="text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0">
            Agent
          </label>
          <select
            id="runs-agent-select"
            className={`${SELECT_CLS} flex-1 min-w-[9rem] sm:min-w-[11rem] max-w-xs`}
            value={runAgentId}
            onChange={(e) => setRunAgentId(e.target.value)}
            disabled={!connId}
          >
            <option value="">{!connId ? "Pick a connection first" : "Choose agent…"}</option>
            {connAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <label htmlFor="runs-run-select" className="text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0">
            Run
          </label>
          <select
            id="runs-run-select"
            className={`${SELECT_CLS} flex-1 min-w-[10rem] sm:min-w-[12rem] max-w-md`}
            value={selectedRun?.id ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                clearRunSelection();
                return;
              }
              const r = runs.find((x) => x.id === id);
              if (r) void selectRun(r);
            }}
            disabled={!runAgentId}
          >
            <option value="">
              {!runAgentId
                ? "Pick an agent first"
                : filteredRuns.length === 0
                  ? "No runs for this agent"
                  : "Choose a run…"}
            </option>
            {sortedFilteredRuns.map((r) => {
              const pname = projects.find((p) => p.id === r.project_id)?.name ?? "Project";
              return (
                <option key={r.id} value={r.id}>
                  {r.id.slice(0, 8)}… — {pname} — {r.status} ({r.completed_questions}/{r.total_questions})
                </option>
              );
            })}
          </select>

          <button
            type="button"
            onClick={() => setShowStartRun((v) => !v)}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 shrink-0"
          >
            {showStartRun ? "Close" : "Start run"}
          </button>
        </div>

        {showStartRun && (
          <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-col gap-1 min-w-[12rem] flex-1 max-w-sm">
              <label htmlFor="runs-project-select" className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Project (for new run)
              </label>
              <select
                id="runs-project-select"
                value={runProjectId}
                onChange={(e) => setRunProjectId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">{projects.length === 0 ? "No projects" : "Choose project…"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await handleCreateRun();
                if (ok) setShowStartRun(false);
              }}
              disabled={creating || !runProjectId || !runAgentId || !connId}
              className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shrink-0"
            >
              {creating ? "Starting..." : "Start Run"}
            </button>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 w-full sm:w-auto sm:flex-1 sm:min-w-[10rem]">
              Uses the connection and agent selected above.
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedRun ? (
          <div className="p-6 flex flex-col gap-4">
            {/* Run header */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${statusDot(selectedRun.status)}`} />
                  <span className={`text-sm font-semibold capitalize ${statusColor(selectedRun.status)}`}>
                    {selectedRun.status}
                  </span>
                  {selectedRun.status === "running" && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                      live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono hidden sm:inline">
                    {selectedRun.id.slice(0, 16)}...
                  </span>
                  {(selectedRun.status === "completed" || selectedRun.status === "failed") && (
                    <>
                      <button
                        onClick={() => { setShowCompare((v) => !v); setComparison(null); }}
                        className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium"
                      >
                        Compare
                      </button>
                      <a
                        href={api.exportRunCsv(selectedRun.id)}
                        download
                        className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium"
                      >
                        Export CSV
                      </a>
                    </>
                  )}
                  {(selectedRun.status === "running" ||
                    selectedRun.status === "pending" ||
                    selectedRun.status === "cancelling") && (
                    <button
                      onClick={() => handleCancelRun(selectedRun.id)}
                      disabled={
                        cancellingRun === selectedRun.id || selectedRun.status === "cancelling"
                      }
                      className="text-xs text-orange-500 hover:text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-40 font-medium"
                    >
                      {cancellingRun === selectedRun.id || selectedRun.status === "cancelling"
                        ? "Cancelling…"
                        : "Cancel Run"}
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDeleteRun(selectedRun.id, e)}
                    disabled={deletingRun === selectedRun.id || selectedRun.status === "running" || selectedRun.status === "cancelling"}
                    title={selectedRun.status === "running" ? "Cancel the run first before deleting" : "Delete run"}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 font-medium"
                  >
                    {deletingRun === selectedRun.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm text-gray-900 dark:text-white font-medium">
                  {selectedRun.completed_questions} / {selectedRun.total_questions} questions
                </span>
                {selectedRun.total_questions > 0 && (
                  <div className="flex-1 flex items-center gap-2 max-w-xs">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                )}
              </div>

              {/* Summary stats */}
              {report && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <StatCard label="Pass Rate" value={`${report.pass_rate}%`} />
                  <StatCard label="Avg Score" value={report.avg_score !== null ? report.avg_score : "—"} />
                  <StatCard label="Avg Latency" value={report.avg_latency_ms !== null ? `${report.avg_latency_ms}ms` : "—"} />
                  <StatCard label="Passed" value={`${report.pass_count}/${report.completed_results}`} />
                  <div className="flex flex-col justify-center ml-2">
                    <p className="text-xs text-gray-400 mb-1">Score distribution</p>
                    <div className="flex gap-1 text-xs flex-wrap">
                      <span className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.5 rounded">0–25: {report.score_distribution.bucket_0_25}</span>
                      <span className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-1.5 py-0.5 rounded">26–50: {report.score_distribution.bucket_26_50}</span>
                      <span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 px-1.5 py-0.5 rounded">51–75: {report.score_distribution.bucket_51_75}</span>
                      <span className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 px-1.5 py-0.5 rounded">76–100: {report.score_distribution.bucket_76_100}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedRun.started_at && (
                <p className="text-xs text-gray-400 mt-2">
                  Started: {new Date(selectedRun.started_at).toLocaleString()}
                  {selectedRun.completed_at && (
                    <> &mdash; Completed: {new Date(selectedRun.completed_at).toLocaleString()}</>
                  )}
                </p>
              )}
            </div>

            {/* Compare panel */}
            {showCompare && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Compare with another run</h4>
                <div className="flex gap-2 mb-4">
                  <select
                    value={compareRunId}
                    onChange={(e) => setCompareRunId(e.target.value)}
                    className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select run B</option>
                    {otherRuns.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id.slice(0, 8)}... — {r.status} ({r.completed_questions}/{r.total_questions})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCompare}
                    disabled={!compareRunId || loadingCompare}
                    className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  >
                    {loadingCompare ? "Loading..." : "Compare"}
                  </button>
                </div>

                {comparison && (
                  <div>
                    <div className="flex gap-4 mb-3">
                      <div className="text-xs text-gray-500">
                        Run A avg: <span className="font-semibold text-gray-900 dark:text-white">{comparison.avg_score_a ?? "—"}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Run B avg: <span className="font-semibold text-gray-900 dark:text-white">{comparison.avg_score_b ?? "—"}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Avg delta: <DeltaBadge delta={comparison.avg_delta ?? null} />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left text-gray-400 font-medium py-2 pr-4 w-full">Question</th>
                            <th className="text-center text-gray-400 font-medium py-2 px-3 whitespace-nowrap">Run A</th>
                            <th className="text-center text-gray-400 font-medium py-2 px-3 whitespace-nowrap">Run B</th>
                            <th className="text-center text-gray-400 font-medium py-2 pl-3 whitespace-nowrap">Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.questions.map((q, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 leading-snug">{q.question_text}</td>
                              <td className="py-2 px-3 text-center text-gray-900 dark:text-white">{q.score_a ?? "—"}</td>
                              <td className="py-2 px-3 text-center text-gray-900 dark:text-white">{q.score_b ?? "—"}</td>
                              <td className="py-2 pl-3 text-center"><DeltaBadge delta={q.delta} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {loadingResults ? (
              <p className="text-sm text-gray-400">Loading results...</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-gray-400 flex items-center gap-2">
                {selectedRun.status === "running" || selectedRun.status === "pending" ? (
                  <><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" />Waiting for first question to start…</>
                ) : "No results available."}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3">
                  <span>{results.length} questions</span>
                  {results.filter((r) => r.status === "completed").length > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      {results.filter((r) => r.status === "completed").length} completed
                    </span>
                  )}
                  {results.filter((r) => r.status === "running" || r.status === "evaluating").length > 0 && (
                    <span className="text-yellow-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
                      {results.filter((r) => r.status === "running").length > 0 ? "sending message…" : "evaluating…"}
                    </span>
                  )}
                  {results.filter((r) => r.status === "failed").length > 0 && (
                    <span className="text-red-500">{results.filter((r) => r.status === "failed").length} failed</span>
                  )}
                </p>

                {results.map((r) => {
                  const isExpanded = expanded === r.id;
                  const isAnnotating = annotating === r.id;
                  const isLive = r.status === "running" || r.status === "evaluating";
                  const isPending = r.status === "pending";
                  return (
                    <div
                      key={r.id}
                      className={`bg-white dark:bg-gray-900 border rounded-lg overflow-hidden transition-colors ${
                        isLive
                          ? "border-yellow-300 dark:border-yellow-700"
                          : r.status === "failed"
                          ? "border-red-200 dark:border-red-900"
                          : "border-gray-200 dark:border-gray-800"
                      }`}
                    >
                      <button
                        onClick={() => !isLive && !isPending && setExpanded(isExpanded ? null : r.id)}
                        className={`w-full text-left p-4 ${isLive || isPending ? "cursor-default" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                              {r.question_text || <span className="text-gray-400 italic">Loading question…</span>}
                            </p>
                            {/* Live response preview */}
                            {r.status === "running" && (
                              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping inline-block" />
                                Sending to agent…
                              </p>
                            )}
                            {r.status === "evaluating" && (
                              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                                Evaluating response…
                              </p>
                            )}
                            {r.status === "completed" && r.response_text && !isExpanded && (
                              <p className="text-xs text-gray-400 mt-1.5 truncate max-w-lg">
                                ↳ {r.response_text}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {r.status === "completed" && <ScoreBadge score={r.score} variant="ai" />}
                            {r.human_score !== null && <ScoreBadge score={r.human_score} variant="human" />}
                            {r.status === "completed" && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${r.answered ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                                {r.answered ? "Answered" : "Unanswered"}
                              </span>
                            )}
                            {r.latency_ms != null && <span className="text-xs text-gray-400">{r.latency_ms}ms</span>}
                            {r.follow_up_utterances?.length > 0 && (
                              <span className="text-xs text-gray-400">+{r.follow_up_utterances.length} follow-ups</span>
                            )}
                            <span className={`text-xs ${statusColor(r.status)} capitalize`}>{r.status}</span>
                            {!isLive && !isPending && (
                              <span className="text-xs text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-4">
                          {/* AI evaluation */}
                          {r.evaluation_notes && (
                            <div className="flex items-start gap-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-3">
                              <div className="shrink-0"><ScoreBadge score={r.score} variant="ai" /></div>
                              <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">{r.evaluation_notes}</p>
                            </div>
                          )}

                          {/* Human annotation */}
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Human Review</p>
                              {!isAnnotating && (
                                <button
                                  onClick={() => {
                                    setAnnotating(r.id);
                                    setAnnotationDraft({
                                      human_score: r.human_score?.toString() ?? "",
                                      human_notes: r.human_notes ?? "",
                                    });
                                  }}
                                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  {r.human_score !== null ? "Edit" : "+ Annotate"}
                                </button>
                              )}
                            </div>

                            {isAnnotating ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex gap-2 items-center">
                                  <label className="text-xs text-gray-400 shrink-0">Score (0–100)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="w-20 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={annotationDraft.human_score}
                                    onChange={(e) => setAnnotationDraft((d) => ({ ...d, human_score: e.target.value }))}
                                    placeholder="—"
                                  />
                                </div>
                                <textarea
                                  rows={2}
                                  className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                                  placeholder="Notes..."
                                  value={annotationDraft.human_notes}
                                  onChange={(e) => setAnnotationDraft((d) => ({ ...d, human_notes: e.target.value }))}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveAnnotation(r.id)}
                                    disabled={savingAnnotation}
                                    className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {savingAnnotation ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    onClick={() => setAnnotating(null)}
                                    className="text-xs text-gray-500 px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : r.human_score !== null || r.human_notes ? (
                              <div className="flex items-start gap-3">
                                <ScoreBadge score={r.human_score} variant="human" />
                                {r.human_notes && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{r.human_notes}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">No human review yet.</p>
                            )}
                          </div>

                          {r.response_text && (
                            <div>
                              <p className="text-xs text-gray-400 mb-1.5">Initial Response</p>
                              <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 rounded-lg p-3 leading-relaxed">
                                {r.response_text}
                              </p>
                            </div>
                          )}

                          {r.follow_up_utterances?.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-400 mb-2">
                                Follow-up Conversation ({r.follow_up_utterances.length} turns)
                              </p>
                              <div className="flex flex-col gap-2">
                                {r.follow_up_utterances.map((u, i) => (
                                  <div key={i} className="flex flex-col gap-1.5">
                                    <div className="flex justify-end">
                                      <div className="bg-indigo-600 text-white text-xs px-3 py-2 rounded-xl max-w-[80%] leading-relaxed">
                                        {u.utterance}
                                      </div>
                                    </div>
                                    <div className="flex justify-start">
                                      <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-xs px-3 py-2 rounded-xl max-w-[80%] leading-relaxed">
                                        {u.response}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full min-h-[12rem] flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-gray-400">
            <p>
              Choose <strong className="text-gray-600 dark:text-gray-300">Connection</strong>, then <strong className="text-gray-600 dark:text-gray-300">Agent</strong>, then <strong className="text-gray-600 dark:text-gray-300">Run</strong> above. Open <strong className="text-gray-600 dark:text-gray-300">Start run</strong> to pick a project and launch a new run.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
