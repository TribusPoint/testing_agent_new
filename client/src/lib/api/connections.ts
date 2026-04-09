import { req, del } from "./client";
import type { Connection, ConnectionCreate, Agent, HttpConnectionConfig, HttpAgentConfig, BrowserAgentConfig } from "./types";

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

// Agents (scoped to connection)
export const listAgents = (connId: string) =>
  req<Agent[]>(`/api/connections/${connId}/agents`);

export const syncAgents = (connId: string) =>
  req<Agent[]>(`/api/connections/${connId}/agents/sync`, { method: "POST", body: "{}" });

export const createAgent = (
  connId: string,
  body: { salesforce_id?: string; name: string; developer_name?: string; agent_type?: string; config?: HttpAgentConfig | BrowserAgentConfig | null }
) =>
  req<Agent>(`/api/connections/${connId}/agents`, { method: "POST", body: JSON.stringify(body) });

export const updateAgent = (
  agentId: string,
  body: { salesforce_id?: string; name?: string; developer_name?: string; agent_type?: string; runtime_url?: string | null }
) => req<Agent>(`/api/agents/${agentId}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteAgent = (agentId: string) => del(`/api/agents/${agentId}`);

// Chat
export const manualChat = (agentId: string, message: string, sessionId?: string) =>
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

export const chatWithAgent = (agentId: string, message: string, sessionId?: string) =>
  req<{ session_id: string; response: string; is_new_session: boolean }>(
    `/api/agents/${agentId}/chat`,
    { method: "POST", body: JSON.stringify({ message, session_id: sessionId ?? null }) }
  );

import { BASE } from "./client";

export const endSession = (agentId: string, sessionId: string) =>
  fetch(`${BASE}/api/agents/${agentId}/sessions/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });

// Discovery / diagnostics
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
