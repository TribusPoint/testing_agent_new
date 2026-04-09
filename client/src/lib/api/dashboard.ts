import { req } from "./client";
import type { DashboardSummary, AgentOption, AgentTrend, WeakQuestion } from "./types";

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
