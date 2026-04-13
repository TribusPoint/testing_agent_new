import { req } from "./client";
import type {
  DashboardSummary, AgentOption, AgentTrend, WeakQuestion,
  FailureBreakdown, DimensionFailure, AgentFailure, HeatmapCell,
} from "./types";

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

export const getFailuresByPersonality = () =>
  req<FailureBreakdown[]>("/api/dashboard/failures/by-personality");

export const getFailuresByPersona = () =>
  req<FailureBreakdown[]>("/api/dashboard/failures/by-persona");

export const getFailuresByDimension = () =>
  req<DimensionFailure[]>("/api/dashboard/failures/by-dimension");

export const getFailuresByAgent = () =>
  req<AgentFailure[]>("/api/dashboard/failures/by-agent");

export const getFailuresHeatmap = () =>
  req<HeatmapCell[]>("/api/dashboard/failures/heatmap");
