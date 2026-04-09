"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import * as api from "@/lib/api";
import TstAgntTable from "@/components/ui/tst-agnt-table";
import { usePersistedState } from "@/lib/usePersistedState";

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

export default function RunsPage() {
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [connections, setConnections] = useState<api.Connection[]>([]);
  const [connAgents, setConnAgents] = useState<api.Agent[]>([]);
  const [allAgents, setAllAgents] = useState<api.Agent[]>([]);

  // Persisted form state (survives page navigation)
  const [runProjectId, setRunProjectId] = usePersistedState("runs:projectId", "");
  const [connId, setConnId] = usePersistedState("runs:connId", "");
  const [runAgentId, setRunAgentId] = usePersistedState("runs:agentId", "");
  const [showStartRun, setShowStartRun] = usePersistedState("runs:showForm", false);
  const [selectedRunId, setSelectedRunId] = usePersistedState<string | null>("runs:selectedRunId", null);

  const [runs, setRuns] = useState<api.Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<api.Run | null>(null);
  const [results, setResults] = useState<api.RunResult[]>([]);
  const [report, setReport] = useState<api.RunReport | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const [cancellingRun, setCancellingRun] = useState<string | null>(null);
  const [exportingRun, setExportingRun] = useState(false);

  // Repo question picker state
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [repoQuestions, setRepoQuestions] = useState<api.RepoQuestion[]>([]);
  const [repoDomains, setRepoDomains] = useState<api.DomainCategoryInfo[]>([]);
  const [repoFilterDomain, setRepoFilterDomain] = useState("");
  const [repoFilterCategory, setRepoFilterCategory] = useState("");
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepoQIds, setSelectedRepoQIds] = useState<Set<string>>(new Set());
  const [loadingRepo, setLoadingRepo] = useState(false);

  // Annotation state
  const [annotating, setAnnotating] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState<{ human_score: string; human_notes: string }>({ human_score: "", human_notes: "" });
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  const streamRef = useRef<AbortController | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.abort();
      streamRef.current = null;
    }
  }

  function clearRunSelection() {
    stopStream();
    setSelectedRun(null);
    setSelectedRunId(null);
    setResults([]);
    setReport(null);
    setExpanded(null);
    setAnnotating(null);
  }

  useEffect(() => {
    Promise.allSettled([api.listProjects(), api.listConnections(), api.listRuns()]).then(
      async ([p, c, r]) => {
        if (p.status === "fulfilled") setProjects(p.value);
        if (c.status === "fulfilled") {
          setConnections(c.value);
          // Load all agents from all connections for display/search
          const agentPromises = c.value.map((conn) => api.listAgents(conn.id).catch(() => []));
          const agentResults = await Promise.all(agentPromises);
          setAllAgents(agentResults.flat());
        }
        if (r.status === "fulfilled") {
          setRuns(r.value);
          // Restore previously selected run if it exists
          if (selectedRunId) {
            const restoredRun = r.value.find((run: api.Run) => run.id === selectedRunId);
            if (restoredRun) {
              selectRun(restoredRun);
            }
          }
        }
      }
    );
    return () => stopStream();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track if this is initial mount to avoid clearing persisted agent selection
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!connId) {
      setConnAgents([]);
      if (!isInitialMount.current) setRunAgentId("");
      return;
    }
    api.listAgents(connId).then(setConnAgents).catch(() => setConnAgents([]));
    // Only clear agent selection if user manually changed connection, not on initial mount
    if (!isInitialMount.current) {
      setRunAgentId("");
    }
    isInitialMount.current = false;
  }, [connId]);

  // Note: Removed the useEffect that cleared selection when runAgentId changed
  // since runs are now selected directly from the table

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

  async function loadRepoQuestions() {
    setLoadingRepo(true);
    try {
      const [qs, doms] = await Promise.allSettled([
        api.listRepoQuestions({
          domain: repoFilterDomain || undefined,
          category: repoFilterCategory || undefined,
          search: repoSearch || undefined,
        }),
        api.listRepoDomains(),
      ]);
      if (qs.status === "fulfilled") setRepoQuestions(qs.value);
      if (doms.status === "fulfilled") setRepoDomains(doms.value);
    } finally {
      setLoadingRepo(false);
    }
  }

  function toggleRepoQ(id: string) {
    setSelectedRepoQIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateRun(): Promise<boolean> {
    if (!connId || !runProjectId || !runAgentId) {
      alert("Select a connection, agent, and project (open Start run to pick the project).");
      return false;
    }
    setCreating(true);
    try {
      const run = await api.createRun({
        project_id: runProjectId,
        agent_id: runAgentId,
        repo_question_ids: selectedRepoQIds.size > 0 ? Array.from(selectedRepoQIds) : undefined,
      });
      setRuns((prev) => [run, ...prev]);
      setSelectedRepoQIds(new Set());
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
      const failMsg =
        type === "run_failed"
          ? (typeof event.error === "string"
              ? event.error
              : event.error != null
                ? JSON.stringify(event.error)
                : null)
          : null;
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? { ...r, status: finalStatus, last_error: failMsg ?? r.last_error }
            : r
        )
      );
      setSelectedRun((prev) =>
        prev?.id === runId
          ? { ...prev, status: finalStatus, last_error: failMsg ?? prev.last_error }
          : prev
      );
      stopStream();
      Promise.allSettled([api.getRun(runId), api.listRunResults(runId), api.getRunReport(runId)]).then(
        ([runRes, res, rep]) => {
          if (runRes.status === "fulfilled") {
            const u = runRes.value;
            setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, ...u } : r)));
            setSelectedRun((prev) => (prev?.id === runId ? { ...prev, ...u } : prev));
          }
          if (res.status === "fulfilled") setResults(res.value);
          if (rep.status === "fulfilled") setReport(rep.value);
        }
      );
    }
  }

  async function selectRun(run: api.Run) {
    setSelectedRun(run);
    setSelectedRunId(run.id);
    setResults([]);
    setReport(null);
    setExpanded(null);
    setAnnotating(null);
    // Auto-scroll to details panel after a short delay for render
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    if (run.status === "completed" || run.status === "failed") {
      setLoadingResults(true);
      try {
        const [fresh, res, rep] = await Promise.allSettled([
          api.getRun(run.id),
          api.listRunResults(run.id),
          api.getRunReport(run.id),
        ]);
        if (fresh.status === "fulfilled") {
          setSelectedRun(fresh.value);
          setRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, ...fresh.value } : r)));
        }
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

  // --- Precompute runs with project/agent names for searching ---
  const runsWithNames = useMemo(() => {
    return runs.map((run) => {
      const project = projects.find((p) => p.id === run.project_id);
      const agent = allAgents.find((a) => a.id === run.agent_id);
      return {
        ...run,
        project_name: project?.name ?? run.project_id,
        agent_name: agent?.name ?? run.agent_id,
      };
    });
  }, [runs, projects, allAgents]);

  // --- Table columns config ---
  const runTableColumns = [
    {
      key: "id",
      label: "Run ID",
      sortable: true,
      searchable: true,
      renderCell: (value: unknown, row: Record<string, unknown>) => (
        <span className="font-mono text-xs">{String(value)}</span>
      ),
    },
    {
      key: "project_name",
      label: "Project",
      sortable: true,
      searchable: true,
    },
    {
      key: "agent_name",
      label: "Agent",
      sortable: true,
      searchable: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      searchable: true,
      renderCell: (value: unknown) => (
        <span className={statusColor(String(value))}>{String(value)}</span>
      ),
    },
    {
      key: "started_at",
      label: "Started",
      sortable: true,
      renderCell: (value: unknown) => value ? new Date(String(value)).toLocaleString() : "—",
    },
    {
      key: "completed_at",
      label: "Completed",
      sortable: true,
      renderCell: (value: unknown) => value ? new Date(String(value)).toLocaleString() : "—",
    },
    {
      key: "completed_questions",
      label: "Questions",
      renderCell: (value: unknown, row: Record<string, unknown>) => `${row.completed_questions}/${row.total_questions}`,
    },
  ];

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50/80 dark:bg-gray-950/40 p-4 overflow-y-auto">
      {showStartRun && (
        <div className="mb-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="text-sm font-semibold mb-3">Start a New Run</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[10rem] flex-1 max-w-xs">
              <label htmlFor="runs-conn-select" className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Connection
              </label>
              <select
                id="runs-conn-select"
                className={SELECT_CLS}
                value={connId}
                onChange={(e) => setConnId(e.target.value)}
              >
                <option value="">{connections.length === 0 ? "No connections" : "Choose connection…"}</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.connection_type === "http" ? "🌐 " : c.connection_type === "browser" ? "🤖 " : "⚡ "}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[10rem] flex-1 max-w-xs">
              <label htmlFor="runs-agent-select" className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Agent
              </label>
              <select
                id="runs-agent-select"
                className={SELECT_CLS}
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
            </div>
            <div className="flex flex-col gap-1 min-w-[10rem] flex-1 max-w-xs">
              <label htmlFor="runs-project-select" className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Project
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
              onClick={() => { setShowRepoPicker((v) => !v); if (!showRepoPicker) loadRepoQuestions(); }}
              className="text-xs px-3 py-2 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium shrink-0"
            >
              + From Repo {selectedRepoQIds.size > 0 ? `(${selectedRepoQIds.size})` : ""}
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await handleCreateRun();
                if (ok) setShowStartRun(false);
              }}
              disabled={creating || !runProjectId || !runAgentId || !connId}
              className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shrink-0"
            >
              {creating ? "Starting..." : `Start Run${selectedRepoQIds.size > 0 ? ` (+${selectedRepoQIds.size} repo)` : ""}`}
            </button>
          </div>

          {/* Repo question picker */}
          {showRepoPicker && (
            <div className="mt-3 p-3 border border-emerald-200 dark:border-emerald-900 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Select questions from the repository
                </p>
                <button type="button" onClick={() => setShowRepoPicker(false)} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-300">
                  Close
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <select
                  value={repoFilterDomain}
                  onChange={(e) => { setRepoFilterDomain(e.target.value); setRepoFilterCategory(""); }}
                  className={SELECT_CLS}
                >
                  <option value="">All domains</option>
                  {repoDomains.map((d) => (
                    <option key={d.domain} value={d.domain}>{d.domain} ({d.count})</option>
                  ))}
                </select>
                <select
                  value={repoFilterCategory}
                  onChange={(e) => setRepoFilterCategory(e.target.value)}
                  disabled={!repoFilterDomain}
                  className={`${SELECT_CLS} disabled:opacity-50`}
                >
                  <option value="">All categories</option>
                  {(repoDomains.find((d) => d.domain === repoFilterDomain)?.categories ?? []).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-[8rem]"
                />
                <button type="button" onClick={loadRepoQuestions} disabled={loadingRepo} className="text-xs px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">
                  {loadingRepo ? "..." : "Filter"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {repoQuestions.length === 0 && !loadingRepo && (
                  <p className="text-xs text-gray-400 py-3 text-center">No repo questions found.</p>
                )}
                {repoQuestions.map((rq) => (
                  <label key={rq.id} className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30 ${selectedRepoQIds.has(rq.id) ? "bg-emerald-100/60 dark:bg-emerald-950/20" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selectedRepoQIds.has(rq.id)}
                      onChange={() => toggleRepoQ(rq.id)}
                      className="mt-0.5 accent-emerald-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-900 dark:text-white">{rq.question}</p>
                      <div className="flex gap-1 mt-0.5">
                        <span className="text-[9px] px-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{rq.domain}</span>
                        <span className="text-[9px] px-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{rq.category}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {selectedRepoQIds.size > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                  {selectedRepoQIds.size} repo question{selectedRepoQIds.size !== 1 ? "s" : ""} selected — they will be added to the run alongside project questions.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="max-w-full">
        <TstAgntTable
          data={runsWithNames as unknown as Record<string, unknown>[]}
          columns={runTableColumns as Parameters<typeof TstAgntTable>[0]["columns"]}
          tableTitle="All Runs"
          actions={
            <button
              type="button"
              onClick={() => setShowStartRun((v) => !v)}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 shrink-0"
            >
              {showStartRun ? "Close" : "+ New Run"}
            </button>
          }
          onRowClick={(row) => selectRun(row as unknown as api.Run)}
          selectedRowId={selectedRun ? selectedRun.id : undefined}
          pagination={{ enabled: true, rowsPerPage: 25 }}
          emptyState={<span className="text-xs text-gray-400">No runs found.</span>}
        />
      </div>

      {/* Run details panel below table */}
      {selectedRun && (
        <div ref={detailsRef} className="mt-6 flex flex-col gap-4">
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
                  {selectedRun.id}
                </span>
                {(selectedRun.status === "completed" || selectedRun.status === "failed") && (
                  <button
                    onClick={async () => {
                      setExportingRun(true);
                      try {
                        await api.exportRunCsv(selectedRun.id);
                      } catch (e: unknown) {
                        alert(e instanceof Error ? e.message : "Export failed");
                      } finally {
                        setExportingRun(false);
                      }
                    }}
                    disabled={exportingRun}
                    className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium disabled:opacity-50"
                  >
                    {exportingRun ? "Exporting..." : "Export CSV"}
                  </button>
                )}
                {(selectedRun.status === "running" ||
                  selectedRun.status === "pending" ||
                  selectedRun.status === "cancelling") && (
                  <button
                    onClick={() => handleCancelRun(selectedRun.id)}
                    disabled={cancellingRun === selectedRun.id || selectedRun.status === "cancelling"}
                    className="text-xs text-orange-500 hover:text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-40 font-medium"
                  >
                    {cancellingRun === selectedRun.id || selectedRun.status === "cancelling" ? "Cancelling…" : "Cancel Run"}
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
                <button
                  onClick={() => clearRunSelection()}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              <span><b>Project:</b> {projects.find((p) => p.id === selectedRun.project_id)?.name ?? selectedRun.project_id}</span>
              <span className="mx-2">|</span>
              <span><b>Agent:</b> {allAgents.find((a) => a.id === selectedRun.agent_id)?.name ?? selectedRun.agent_id}</span>
            </div>

            {selectedRun.status === "failed" ? (
              <div
                role="alert"
                className="mb-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-800 dark:text-red-200"
              >
                <p className="font-semibold mb-1">Run stopped before questions were executed</p>
                {selectedRun.last_error ? (
                  <p className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                    {selectedRun.last_error}
                  </p>
                ) : (
                  <p className="text-[11px]">
                    No error detail stored for this run. Usually the worker could not log in to Salesforce
                    before the first question. Check server logs and <strong>Connections</strong> (domain, key,
                    secret), then start a new run after deploying the latest API.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-red-700/90 dark:text-red-300/90">
                  For Salesforce: use the org hostname only (no <code className="text-[10px]">https://</code>).
                  Ensure <strong>OPENAI_API_KEY</strong> is set on the server for follow-ups and scoring.
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm text-gray-900 dark:text-white font-medium">
                {selectedRun.completed_questions} / {selectedRun.total_questions} questions
              </span>
              {selectedRun.total_questions > 0 && (
                <div className="flex-1 flex items-center gap-2 max-w-xs">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${selectedRun.total_questions > 0 ? Math.round((selectedRun.completed_questions / selectedRun.total_questions) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{selectedRun.total_questions > 0 ? Math.round((selectedRun.completed_questions / selectedRun.total_questions) * 100) : 0}%</span>
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
              </div>
            )}

            {selectedRun.started_at && (
              <p className="text-xs text-gray-400 mt-2">
                Started: {new Date(selectedRun.started_at).toLocaleString()}
                {selectedRun.completed_at && (
                  <> — Completed: {new Date(selectedRun.completed_at).toLocaleString()}</>
                )}
              </p>
            )}
          </div>

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
                  <span className="text-green-600 dark:text-green-400">{results.filter((r) => r.status === "completed").length} completed</span>
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
                const isLive = r.status === "running" || r.status === "evaluating";
                const isPending = r.status === "pending";
                return (
                  <div
                    key={r.id}
                    className={`bg-white dark:bg-gray-900 border rounded-lg overflow-hidden transition-colors ${
                      isLive ? "border-yellow-300 dark:border-yellow-700" : r.status === "failed" ? "border-red-200 dark:border-red-900" : "border-gray-200 dark:border-gray-800"
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
                          {r.status === "running" && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1.5 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping inline-block" />Sending to agent…
                            </p>
                          )}
                          {r.status === "evaluating" && (
                            <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1.5 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />Evaluating response…
                            </p>
                          )}
                          {r.status === "completed" && r.response_text && !isExpanded && (
                            <p className="text-xs text-gray-400 mt-1.5 truncate max-w-lg">↳ {r.response_text}</p>
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
                          <span className={`text-xs ${statusColor(r.status)} capitalize`}>{r.status}</span>
                          {!isLive && !isPending && <span className="text-xs text-gray-400">{isExpanded ? "▲" : "▼"}</span>}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-4">
                        {r.evaluation_notes && (
                          <div className="flex items-start gap-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-3">
                            <div className="shrink-0"><ScoreBadge score={r.score} variant="ai" /></div>
                            <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">{r.evaluation_notes}</p>
                          </div>
                        )}
                        {r.response_text && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1.5">Response</p>
                            <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 rounded-lg p-3 leading-relaxed">{r.response_text}</p>
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
      )}
    </div>
  );
}
