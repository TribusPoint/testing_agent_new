import { req, del, getStoredKey, BASE } from "./client";
import type { Run, RunResult, RunReport, RunComparison } from "./types";

export const createRun = (b: { project_id: string; agent_id: string; question_ids?: string[]; repo_question_ids?: string[] }) =>
  req<Run>("/api/runs", { method: "POST", body: JSON.stringify(b) });

export const listRuns = (projectId?: string) =>
  req<Run[]>(`/api/runs${projectId ? `?project_id=${projectId}` : ""}`);

export const getRun = (id: string) => req<Run>(`/api/runs/${id}`);

export const listRunResults = (runId: string) =>
  req<RunResult[]>(`/api/runs/${runId}/results`);

export const getRunReport = (runId: string) =>
  req<RunReport>(`/api/runs/${runId}/report`);

export const exportRunCsv = async (runId: string) => {
  const key = getStoredKey();
  const res = await fetch(`${BASE}/api/runs/${runId}/export`, {
    headers: key ? { "X-API-Key": key } : {},
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/settings";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? "Export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `run-${runId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const annotateResult = (runId: string, resultId: string, body: { human_score: number | null; human_notes: string | null }) =>
  req<{ ok: boolean }>(`/api/runs/${runId}/results/${resultId}/annotate`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const compareRuns = (runA: string, runB: string) =>
  req<RunComparison>(`/api/runs/compare?run_a=${runA}&run_b=${runB}`);

export const deleteRun = (id: string) => del(`/api/runs/${id}`);

export const cancelRun = (id: string) =>
  req<{ ok: boolean; message: string }>(`/api/runs/${id}/cancel`, { method: "POST", body: "{}" });

export const streamRunUrl = (runId: string): string =>
  `${BASE}/api/runs/${runId}/stream`;
