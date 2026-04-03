const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const KEY_STORAGE = "ta_api_key";

export function getStoredKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_STORAGE) ?? "";
}

export function setStoredKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key);
}

export function clearStoredKey() {
  localStorage.removeItem(KEY_STORAGE);
}

async function del(path: string): Promise<void> {
  const key = getStoredKey();
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: key ? { "X-API-Key": key } : {},
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/settings";
    throw new Error("Unauthorized");
  }
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `Delete failed (${res.status})`);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getStoredKey();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "X-API-Key": key } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/settings";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? "Request failed");
  }
  return res.json() as T;
}

// Browser probe
export interface ProbeCandidate {
  selector: string;
  score: number;
  count: number;
  placeholder?: string;
  text?: string;
  iframe?: string | null;
}
export interface ProbeResult {
  success: boolean;
  found_count?: number;
  url?: string;
  launcher_clicked?: string | null;
  error?: string;
  log?: string[];
  suggested?: {
    input_selector: string;
    send_selector: string;
    response_selector: string;
    iframe_selector: string;
    load_wait_ms: number;
    wait_after_send_ms: number;
  };
  candidates?: {
    input: ProbeCandidate[];
    send: ProbeCandidate[];
    response: ProbeCandidate[];
  };
  raw_dump?: Record<string, {
    inputs: Array<{ tag: string; attrs: Record<string, string>; rect: { w: number; h: number } }>;
    buttons: Array<{ tag: string; attrs: Record<string, string>; text: string; rect: { w: number; h: number } }>;
    iframe_sel: string | null;
  }>;
  screenshot_b64?: string | null;
}
export const probeBrowserUrl = (url: string) =>
  req<ProbeResult>("/api/browser/probe", { method: "POST", body: JSON.stringify({ url }) });

// Connections
export const listConnections = () => req<Connection[]>("/api/connections");
export const createConnection = (b: ConnectionCreate) =>
  req<Connection>("/api/connections", { method: "POST", body: JSON.stringify(b) });
export const updateConnection = (
  id: string,
  body: { name?: string; domain?: string; consumer_key?: string; consumer_secret?: string; config?: HttpConnectionConfig | null }
) => req<Connection>(`/api/connections/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteConnection = (id: string) => del(`/api/connections/${id}`);
export const testConnection = (id: string) =>
  req<{ success: boolean; message: string; agent_count: number }>(
    `/api/connections/${id}/test`,
    { method: "POST", body: "{}" }
  );

// Agents
export const listAgents = (connId: string) =>
  req<Agent[]>(`/api/connections/${connId}/agents`);
export const syncAgents = (connId: string) =>
  req<Agent[]>(`/api/connections/${connId}/agents/sync`, { method: "POST", body: "{}" });
export const createAgent = (
  connId: string,
  body: { salesforce_id?: string; name: string; developer_name?: string; agent_type?: string; config?: HttpAgentConfig | BrowserAgentConfig | null }
) =>
  req<Agent>(`/api/connections/${connId}/agents`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateAgent = (
  agentId: string,
  body: { salesforce_id?: string; name?: string; developer_name?: string; agent_type?: string; runtime_url?: string | null }
) => req<Agent>(`/api/agents/${agentId}`, { method: "PATCH", body: JSON.stringify(body) });

export const manualChat = (
  agentId: string,
  message: string,
  sessionId?: string
) =>
  req<{
    session_id: string;
    new_session: boolean;
    response: string;
    agent_id_used: string;
    developer_name_used: string;
    runtime_url_used: string;
  }>(`/api/agents/${agentId}/manual-chat`, {
    method: "POST",
    body: JSON.stringify({ message, session_id: sessionId ?? null }),
  });

export const discoverEndpoints = (connId: string) =>
  req<{
    domain: string;
    probes: { label: string; url: string; status: number; ok: boolean; data: unknown }[];
  }>(`/api/connections/${connId}/discover-endpoints`);

export const describeSObject = (connId: string, name: string) =>
  req<{ sobject: string; api: string; version: string; fields: { name: string; label: string; type: string }[] }>(
    `/api/connections/${connId}/describe/${name}`
  );

export const runSoql = (connId: string, query: string) =>
  req<{ ok: boolean; endpoint?: string; totalSize?: number; records?: Record<string, unknown>[]; error?: unknown }>(
    `/api/connections/${connId}/soql`,
    { method: "POST", body: JSON.stringify({ query }) }
  );

export const discoverRuntimeIds = (connId: string) =>
  req<{
    agents: { id: string; name: string; developer_name: string; source: string }[];
    errors: string[];
    instructions: string;
  }>(`/api/connections/${connId}/agents/runtime-ids`);

export const chatWithAgent = (agentId: string, message: string, sessionId?: string) =>
  req<{ session_id: string; response: string; is_new_session: boolean }>(
    `/api/agents/${agentId}/chat`,
    { method: "POST", body: JSON.stringify({ message, session_id: sessionId ?? null }) }
  );
export const endSession = (agentId: string, sessionId: string) =>
  fetch(`${BASE}/api/agents/${agentId}/sessions/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });

// Projects
export const listProjects = () => req<Project[]>("/api/projects");
export const createProject = (b: ProjectCreate) =>
  req<Project>("/api/projects", { method: "POST", body: JSON.stringify(b) });
export const updateProject = (
  id: string,
  body: { name?: string; description?: string; company_name?: string; industry?: string; competitors?: string; company_websites?: string }
) => req<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteProject = (id: string) => del(`/api/projects/${id}`);

// Generate
export const generatePersonas = (projectId: string, agentId: string) =>
  req<Persona[]>(`/api/projects/${projectId}/generate/personas`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId }),
  });
export const generateDimensions = (projectId: string) =>
  req<Dimension[]>(`/api/projects/${projectId}/generate/dimensions`, {
    method: "POST",
    body: "{}",
  });
export const generateProfiles = (projectId: string) =>
  req<PersonalityProfile[]>(`/api/projects/${projectId}/generate/personality-profiles`, {
    method: "POST",
    body: "{}",
  });
export const generateQuestions = (projectId: string, agentId: string, n = 30) =>
  req<Question[]>(`/api/projects/${projectId}/generate/questions`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, questions_per_agent: n }),
  });

// Fetch context data
export const listPersonas = (projectId: string) =>
  req<Persona[]>(`/api/projects/${projectId}/personas`);
export const listDimensions = (projectId: string) =>
  req<Dimension[]>(`/api/projects/${projectId}/dimensions`);
export const listProfiles = (projectId: string) =>
  req<PersonalityProfile[]>(`/api/projects/${projectId}/personality-profiles`);
export const listQuestions = (projectId: string) =>
  req<Question[]>(`/api/projects/${projectId}/questions`);
export const updateQuestion = (projectId: string, questionId: string, body: { expected_answer: string | null }) =>
  req<Question>(`/api/projects/${projectId}/questions/${questionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

// Runs
export const createRun = (b: { project_id: string; agent_id: string; question_ids?: string[] }) =>
  req<Run>("/api/runs", { method: "POST", body: JSON.stringify(b) });
export const listRuns = (projectId?: string) =>
  req<Run[]>(`/api/runs${projectId ? `?project_id=${projectId}` : ""}`);
export const getRun = (id: string) => req<Run>(`/api/runs/${id}`);
export const listRunResults = (runId: string) =>
  req<RunResult[]>(`/api/runs/${runId}/results`);
export const getRunReport = (runId: string) =>
  req<RunReport>(`/api/runs/${runId}/report`);
export const exportRunCsv = (runId: string) =>
  `${BASE}/api/runs/${runId}/export`;
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

// Types
export interface HttpConnectionConfig {
  auth_type: "none" | "api_key" | "bearer" | "basic";
  auth_header?: string;
  auth_value?: string;
  test_url?: string;
}

export interface HttpAgentConfig {
  endpoint: string;
  method: string;
  body_template: string;
  response_path: string;
  extra_headers?: Record<string, string>;
}

export interface BrowserAgentConfig {
  url: string;
  input_selector: string;
  send_selector: string;
  response_selector: string;
  iframe_selector?: string;
  load_wait_ms?: number;
  wait_after_send_ms?: number;
  clear_input?: boolean;
}

export interface Connection {
  id: string;
  connection_type: string;  // "salesforce" | "http"
  name: string;
  domain: string;
  consumer_key: string;
  default_agent_id: string | null;
  config: HttpConnectionConfig | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionCreate {
  connection_type?: string;
  name: string;
  // Salesforce
  domain?: string;
  consumer_key?: string;
  consumer_secret?: string;
  // HTTP
  config?: HttpConnectionConfig | null;
}
export interface Agent {
  id: string;
  connection_id: string;
  salesforce_id: string;
  name: string;
  developer_name: string;
  agent_type: string;
  runtime_url: string | null;
  config: HttpAgentConfig | BrowserAgentConfig | null;
  topics: { id: string; name: string; description: string }[];
  actions: { id: string; name: string }[];
  created_at: string;
  updated_at: string;
}
export interface Project {
  id: string;
  name: string;
  description: string | null;
  company_name: string | null;
  company_websites: string | null;
  industry: string | null;
  competitors: string | null;
  created_at: string;
  updated_at: string;
}
export interface ProjectCreate {
  name: string;
  description?: string;
  company_name?: string;
  company_websites?: string;
  industry?: string;
  competitors?: string;
}
export interface Persona {
  id: string;
  project_id: string;
  agent_id: string | null;
  name: string;
  description: string | null;
  tag: string | null;
}
export interface DimensionValue {
  id: string;
  dimension_id: string;
  name: string;
  description: string | null;
}
export interface Dimension {
  id: string;
  project_id: string;
  name: string;
  values: DimensionValue[];
}
export interface PersonalityProfile {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
}
export interface Question {
  id: string;
  project_id: string;
  agent_id: string;
  question: string;
  expected_answer: string | null;
  persona: string | null;
  dimension: string | null;
  dimension_value: string | null;
  personality_profile: string | null;
}
export interface Run {
  id: string;
  project_id: string;
  agent_id: string;
  status: string;
  total_questions: number;
  completed_questions: number;
  started_at: string | null;
  completed_at: string | null;
}
export interface RunResult {
  id: string;
  run_id: string;
  question_id: string | null;
  question_text: string;
  response_text: string | null;
  follow_up_utterances: { utterance: string; response: string }[];
  latency_ms: number | null;
  answered: boolean | null;
  score: number | null;
  evaluation_notes: string | null;
  human_score: number | null;
  human_notes: string | null;
  status: string;
}
export interface RunComparison {
  run_a: string;
  run_b: string;
  avg_score_a: number | null;
  avg_score_b: number | null;
  avg_delta: number | null;
  questions: {
    question_id: string | null;
    question_text: string;
    score_a: number | null;
    score_b: number | null;
    delta: number | null;
  }[];
}
export interface RunReport {
  run_id: string;
  status: string;
  total_results: number;
  completed_results: number;
  pass_count: number;
  pass_rate: number;
  avg_score: number | null;
  avg_latency_ms: number | null;
  score_distribution: {
    bucket_0_25: number;
    bucket_26_50: number;
    bucket_51_75: number;
    bucket_76_100: number;
  };
}

// Auth
// LLM config
export const getLlmConfig = () =>
  req<{ provider: string; generation_model: string; evaluation_model: string; utterance_model: string }>("/api/config");

export const verifyKey = (key: string) =>
  fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail ?? "Invalid key");
    return body as { valid: boolean; name: string };
  });

export const createApiKey = (name: string, masterKey: string) =>
  fetch(`${BASE}/api/auth/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": masterKey },
    body: JSON.stringify({ name }),
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail ?? "Failed");
    return body as ApiKeyCreated;
  });

export const listApiKeys = (masterKey: string) =>
  fetch(`${BASE}/api/auth/keys`, {
    headers: { "X-API-Key": masterKey },
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail ?? "Failed");
    return body as ApiKeyInfo[];
  });

export const revokeApiKey = (id: string, masterKey: string) =>
  fetch(`${BASE}/api/auth/keys/${id}`, {
    method: "DELETE",
    headers: { "X-API-Key": masterKey },
  });

export interface ApiKeyInfo {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}
export interface ApiKeyCreated extends ApiKeyInfo {
  plain_key: string;
}

export const streamRunUrl = (runId: string): string =>
  `${BASE}/api/runs/${runId}/stream`;

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
