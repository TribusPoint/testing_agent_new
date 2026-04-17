"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import TstAgntTable, { type TstAgntColumnConfig } from "@/components/ui/tst-agnt-table";
import { BOOTSTRAP_SESSION_PREFIX, Candidate, INPUT_CLS, connectionTypeLabel } from "../lib/constants";
import { BootstrapDiagnosticsPanel } from "./bootstrap-diagnostics-panel";

export function AgentforceConnectionDetail({ connection: initial }: { connection: api.Connection }) {
  const router = useRouter();
  const [connection, setConnection] = useState(initial);
  const [agents, setAgents] = useState<api.Agent[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [bootstrapDiagnostics, setBootstrapDiagnostics] = useState<Record<string, unknown> | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [deletingConn, setDeletingConn] = useState(false);
  const [showEditConn, setShowEditConn] = useState(false);
  const [editConnForm, setEditConnForm] = useState({ name: "", domain: "", consumer_key: "", consumer_secret: "" });
  const [savingConn, setSavingConn] = useState(false);

  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentForm, setAgentForm] = useState({ salesforce_id: "", name: "", developer_name: "" });
  const [savingAgent, setSavingAgent] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [addingCandidateId, setAddingCandidateId] = useState<string | null>(null);

  const loadAgentsOnly = useCallback(async () => {
    try {
      setAgents(await api.listAgents(connection.id));
    } catch {
      setAgents([]);
    }
  }, [connection.id]);

  useEffect(() => {
    setConnection(initial);
  }, [initial]);

  useEffect(() => {
    const key = `${BOOTSTRAP_SESSION_PREFIX}${connection.id}`;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw) as {
          agents: api.Agent[];
          candidates: Candidate[];
          message: string;
          diagnostics?: unknown;
        };
        setAgents(d.agents ?? []);
        setCandidates(d.candidates ?? []);
        setBootstrapMessage(d.message ?? null);
        setBootstrapDiagnostics(
          d.diagnostics !== null && d.diagnostics !== undefined && typeof d.diagnostics === "object"
            ? (d.diagnostics as Record<string, unknown>)
            : null,
        );
        sessionStorage.removeItem(key);
        return;
      }
    } catch {
      /* ignore */
    }
    setBootstrapMessage(null);
    setBootstrapDiagnostics(null);
    setCandidates([]);
    void loadAgentsOnly();
  }, [connection.id, loadAgentsOnly]);

  async function handleRefreshAgents() {
    setRefreshing(true);
    setBootstrapMessage(null);
    setBootstrapDiagnostics(null);
    try {
      const p = await api.bootstrapSalesforceConnection(connection.id);
      setAgents(p.agents);
      setCandidates(p.candidates as Candidate[]);
      setBootstrapMessage(p.message);
      setBootstrapDiagnostics(
        p.diagnostics !== null && p.diagnostics !== undefined && typeof p.diagnostics === "object"
          ? (p.diagnostics as Record<string, unknown>)
          : null,
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDeleteConn() {
    if (!confirm(`Delete connection "${connection.name}" and all its agents?`)) return;
    setDeletingConn(true);
    try {
      await api.deleteConnection(connection.id);
      router.push("/connections");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingConn(false);
    }
  }

  function openEditConn() {
    setEditConnForm({
      name: connection.name,
      domain: connection.domain,
      consumer_key: "",
      consumer_secret: "",
    });
    setShowEditConn(true);
  }

  async function handleSaveConn() {
    setSavingConn(true);
    try {
      const body: Record<string, string> = { name: editConnForm.name, domain: editConnForm.domain };
      if (editConnForm.consumer_key) body.consumer_key = editConnForm.consumer_key;
      if (editConnForm.consumer_secret) body.consumer_secret = editConnForm.consumer_secret;
      const updated = await api.updateConnection(connection.id, body);
      setConnection(updated);
      setShowEditConn(false);
      await handleRefreshAgents();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingConn(false);
    }
  }

  async function handleAddAgentManual() {
    if (!agentForm.salesforce_id.trim() || !agentForm.name.trim()) return;
    setSavingAgent(true);
    try {
      const agent = await api.createAgent(connection.id, {
        salesforce_id: agentForm.salesforce_id.trim(),
        name: agentForm.name.trim(),
        developer_name: agentForm.developer_name.trim() || agentForm.name.trim(),
        agent_type: "agentforce",
      });
      setAgents((prev) => {
        const exists = prev.find((a) => a.id === agent.id);
        return exists ? prev.map((a) => (a.id === agent.id ? agent : a)) : [...prev, agent];
      });
      setAgentForm({ salesforce_id: "", name: "", developer_name: "" });
      setShowAgentForm(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to add agent");
    } finally {
      setSavingAgent(false);
    }
  }

  async function handleAddCandidate(row: Candidate) {
    setAddingCandidateId(row.id);
    try {
      const agent = await api.createAgent(connection.id, {
        salesforce_id: row.id,
        name: (row.name || row.developer_name || row.id).trim(),
        developer_name: (row.developer_name || row.name || row.id).trim(),
        agent_type: "agentforce",
      });
      setAgents((prev) => [...prev.filter((a) => a.id !== agent.id), agent]);
      setCandidates((prev) => prev.filter((c) => c.id !== row.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to add agent");
    } finally {
      setAddingCandidateId(null);
    }
  }

  async function handleDeleteAgent(agent: api.Agent) {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    setDeletingAgentId(agent.id);
    try {
      await api.deleteAgent(agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingAgentId(null);
    }
  }

  const agentTableRows = agents.map((a) => ({
    id: a.id,
    name: a.name,
    sfId: a.salesforce_id,
    _agent: a,
  }));

  const agentTableColumns: TstAgntColumnConfig<(typeof agentTableRows)[0]>[] = [
    { key: "name", label: "Name", searchable: true },
    {
      key: "sfId",
      label: "Salesforce ID",
      searchable: true,
      renderCell: (v) => (
        <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[200px] block">
          {String(v)}
        </span>
      ),
    },
    {
      key: "deleteAction",
      label: "",
      renderCell: (_v, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleDeleteAgent(row._agent);
          }}
          disabled={deletingAgentId === row._agent.id}
          className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-40"
        >
          {deletingAgentId === row._agent.id ? "…" : "Delete"}
        </button>
      ),
    },
  ];

  const candidateRows = candidates.map((c) => ({
    id: c.id,
    name: c.name || "—",
    developer_name: c.developer_name || "—",
    sfRecordId: c.id,
    source: c.source || "—",
    _c: c,
  }));

  const candidateColumns: TstAgntColumnConfig<(typeof candidateRows)[0]>[] = [
    { key: "name", label: "Name", searchable: true },
    { key: "developer_name", label: "Developer", searchable: true },
    {
      key: "sfRecordId",
      label: "Id",
      searchable: true,
      renderCell: (v) => <span className="font-mono text-[10px]">{String(v)}</span>,
    },
    { key: "source", label: "Source", searchable: true },
    {
      key: "addAction",
      label: "",
      renderCell: (_v, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleAddCandidate(row._c);
          }}
          disabled={addingCandidateId === row._c.id}
          className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-40"
        >
          {addingCandidateId === row._c.id ? "…" : "+ Add"}
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-1 min-h-0 flex-col min-w-0">
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href="/connections"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium inline-block mb-1"
            >
              ← All connections
            </Link>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{connection.name}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{connection.domain}</p>
            <p className="text-[10px] text-gray-400">Type: {connectionTypeLabel(connection.connection_type)}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleRefreshAgents()}
              disabled={refreshing}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh agents"}
            </button>
            <button
              type="button"
              onClick={() => openEditConn()}
              className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Edit connection
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteConn()}
              disabled={deletingConn}
              className="text-xs px-3 py-1.5 text-red-600 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
            >
              {deletingConn ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
        {bootstrapMessage ? (
          <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 rounded px-2 py-1.5">
            {bootstrapMessage}
          </p>
        ) : null}
        <BootstrapDiagnosticsPanel data={bootstrapDiagnostics} />
      </div>

      {showEditConn && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Edit connection</p>
          <div className="flex flex-col gap-2 max-w-md">
            <input
              placeholder="Name"
              value={editConnForm.name}
              onChange={(e) => setEditConnForm((f) => ({ ...f, name: e.target.value }))}
              className={INPUT_CLS}
            />
            <input
              placeholder="Domain"
              value={editConnForm.domain}
              onChange={(e) => setEditConnForm((f) => ({ ...f, domain: e.target.value }))}
              className={INPUT_CLS}
            />
            <input
              placeholder="New consumer key (leave blank to keep)"
              value={editConnForm.consumer_key}
              onChange={(e) => setEditConnForm((f) => ({ ...f, consumer_key: e.target.value }))}
              className={INPUT_CLS}
            />
            <input
              type="password"
              placeholder="New consumer secret (leave blank to keep)"
              value={editConnForm.consumer_secret}
              onChange={(e) => setEditConnForm((f) => ({ ...f, consumer_secret: e.target.value }))}
              className={INPUT_CLS}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSaveConn()}
                disabled={savingConn}
                className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingConn ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowEditConn(false)}
                className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white dark:bg-gray-900 min-h-0">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-800 dark:text-gray-200 m-0">Agents ({agents.length})</h2>
            <button
              type="button"
              onClick={() => setShowAgentForm((v) => !v)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {showAgentForm ? "Close manual add" : "+ Add agent manually"}
            </button>
          </div>
          {showAgentForm && (
            <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
              <p className="text-[10px] text-amber-900 dark:text-amber-200">
                Paste the Salesforce agent / bot record ID (15 or 18 characters), plus display name.
              </p>
              <input
                placeholder="Salesforce agent ID"
                value={agentForm.salesforce_id}
                onChange={(e) => setAgentForm((f) => ({ ...f, salesforce_id: e.target.value }))}
                className={INPUT_CLS}
              />
              <input
                placeholder="Display name"
                value={agentForm.name}
                onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))}
                className={INPUT_CLS}
              />
              <input
                placeholder="Developer name (optional)"
                value={agentForm.developer_name}
                onChange={(e) => setAgentForm((f) => ({ ...f, developer_name: e.target.value }))}
                className={INPUT_CLS}
              />
              <button
                type="button"
                onClick={() => void handleAddAgentManual()}
                disabled={savingAgent || !agentForm.salesforce_id.trim() || !agentForm.name.trim()}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingAgent ? "Saving…" : "Save agent"}
              </button>
            </div>
          )}
          <TstAgntTable
            data={agentTableRows}
            columns={agentTableColumns}
            enableSearch
            searchPlaceholder="Search agents…"
            pagination={{ enabled: true, rowsPerPage: 10 }}
            emptyState={<p className="text-xs text-gray-400">No agents yet — use candidates below or manual add.</p>}
          />
        </div>

        {candidates.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Discovered candidates ({candidates.length})
            </h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
              Not saved until you click <strong>+ Add</strong>. IDs come from auto-discovery and SOQL on your org.
            </p>
            <TstAgntTable
              data={candidateRows}
              columns={candidateColumns}
              enableSearch
              searchPlaceholder="Search candidates…"
              pagination={{ enabled: true, rowsPerPage: 10 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
