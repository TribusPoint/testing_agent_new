"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "@/lib/api";
import TstAgntTable, { type TstAgntColumnConfig } from "@/components/ui/tst-agnt-table";
import { usePersistedState } from "@/lib/usePersistedState";

type Msg = { role: "user" | "agent" | "error"; text: string };

const INPUT_CLS =
  "w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<api.Connection[]>([]);
  const [selected, setSelected] = useState<api.Connection | null>(null);
  const [selectedConnId, setSelectedConnId] = usePersistedState<string | null>("connections:selectedId", null);
  const [agents, setAgents] = useState<api.Agent[]>([]);
  const [chatAgent, setChatAgent] = useState<api.Agent | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [showForm, setShowForm] = usePersistedState("connections:showForm", false);
  const [connType, setConnType] = usePersistedState<"salesforce" | "http" | "browser">("connections:connType", "salesforce");
  const [form, setForm] = usePersistedState("connections:form", { name: "", domain: "", consumer_key: "", consumer_secret: "" });
  const [httpForm, setHttpForm] = usePersistedState("connections:httpForm", { auth_type: "none", auth_value: "", test_url: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [deletingConn, setDeletingConn] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [showEditConn, setShowEditConn] = useState(false);
  const [editConnForm, setEditConnForm] = useState({ name: "", domain: "", consumer_key: "", consumer_secret: "" });
  const [savingConn, setSavingConn] = useState(false);

  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentForm, setAgentForm] = useState({ salesforce_id: "", name: "", developer_name: "" });
  const [savingAgent, setSavingAgent] = useState(false);

  // HTTP agent form
  const [httpAgentForm, setHttpAgentForm] = useState({
    name: "",
    endpoint: "",
    method: "POST",
    body_template: '{"message": "{{question}}"}',
    response_path: "",
    auth_value: "",
  });
  const [savingHttpAgent, setSavingHttpAgent] = useState(false);
  const [showHttpAgentForm, setShowHttpAgentForm] = useState(false);

  // Browser agent form
  const [browserAgentForm, setBrowserAgentForm] = useState({
    name: "",
    url: "",
    input_selector: "",
    send_selector: "",
    response_selector: "",
    iframe_selector: "",
    wait_after_send_ms: "5000",
    load_wait_ms: "2000",
  });
  const [savingBrowserAgent, setSavingBrowserAgent] = useState(false);
  const [showBrowserAgentForm, setShowBrowserAgentForm] = useState(false);
  const [screenshotResult, setScreenshotResult] = useState<{ success: boolean; message: string; screenshot_b64?: string | null } | null>(null);
  const [takingScreenshot, setTakingScreenshot] = useState(false);
  const [probeResult, setProbeResult] = useState<api.ProbeResult | null>(null);
  const [probing, setProbing] = useState(false);

  // Edit agent
  const [editingAgent, setEditingAgent] = useState<api.Agent | null>(null);
  const [editAgentForm, setEditAgentForm] = useState({ salesforce_id: "", name: "", developer_name: "", runtime_url: "" });
  const [savingEditAgent, setSavingEditAgent] = useState(false);

  // Manual chat
  const [manualChatAgent, setManualChatAgent] = useState<api.Agent | null>(null);
  const [manualChatInput, setManualChatInput] = useState("");
  const [manualChatSession, setManualChatSession] = useState<string | null>(null);
  const [manualChatMessages, setManualChatMessages] = useState<{ role: "user" | "agent" | "error"; text: string; meta?: string }[]>([]);
  const [manualChatLoading, setManualChatLoading] = useState(false);
  const manualChatEndRef = useRef<HTMLDivElement>(null);

  // SOQL diagnostic
  const [soqlQuery, setSoqlQuery] = useState("SELECT Id, MasterLabel, DeveloperName FROM BotDefinition");
  const [soqlResult, setSoqlResult] = useState<{ ok: boolean; endpoint?: string; totalSize?: number; records?: Record<string, unknown>[]; error?: unknown } | null>(null);
  const [runningSoql, setRunningSoql] = useState(false);
  const [describeResult, setDescribeResult] = useState<{ sobject: string; note?: string; fields: { name: string; label: string; type: string }[] } | null>(null);
  const [describingObj, setDescribingObj] = useState<string | null>(null);

  // Runtime ID discovery
  const [discoveringRuntime, setDiscoveringRuntime] = useState(false);
  const [runtimeResult, setRuntimeResult] = useState<{
    agents: { id: string; name: string; developer_name: string; source: string }[];
    errors: string[];
    instructions: string;
  } | null>(null);

  // Endpoint discovery
  const [discoveringEndpoints, setDiscoveringEndpoints] = useState(false);
  const [endpointResult, setEndpointResult] = useState<{
    domain: string;
    probes: { label: string; url: string; status: number; ok: boolean; data: unknown }[];
  } | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConnections(); }, []);

  // Restore selected connection from persisted ID
  useEffect(() => {
    if (selectedConnId && connections.length > 0 && !selected) {
      const restored = connections.find((c) => c.id === selectedConnId);
      if (restored) selectConnection(restored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, selectedConnId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    manualChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [manualChatMessages]);

  async function loadConnections() {
    try { setConnections(await api.listConnections()); } catch {}
  }

  async function selectConnection(c: api.Connection) {
    setSelected(c);
    setSelectedConnId(c.id);
    setChatAgent(null);
    setMessages([]);
    setSessionId(null);
    setTestResult(null);
    try { setAgents(await api.listAgents(c.id)); } catch { setAgents([]); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (connType === "http") {
        await api.createConnection({
          connection_type: "http",
          name: form.name,
          config: {
            auth_type: httpForm.auth_type as api.HttpConnectionConfig["auth_type"],
            auth_value: httpForm.auth_value,
            test_url: httpForm.test_url,
          },
        });
      } else if (connType === "browser") {
        await api.createConnection({
          connection_type: "browser",
          name: form.name,
        });
      } else {
        await api.createConnection({ connection_type: "salesforce", ...form });
      }
      setForm({ name: "", domain: "", consumer_key: "", consumer_secret: "" });
      setHttpForm({ auth_type: "none", auth_value: "", test_url: "" });
      setShowForm(false);
      await loadConnections();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  async function handleSaveHttpAgent() {
    if (!selected || !httpAgentForm.name.trim() || !httpAgentForm.endpoint.trim()) return;
    setSavingHttpAgent(true);
    try {
      const agent = await api.createAgent(selected.id, {
        name: httpAgentForm.name.trim(),
        developer_name: httpAgentForm.name.trim(),
        agent_type: "http",
        config: {
          endpoint: httpAgentForm.endpoint.trim(),
          method: httpAgentForm.method,
          body_template: httpAgentForm.body_template,
          response_path: httpAgentForm.response_path.trim(),
        },
      });
      setAgents((prev) => {
        const exists = prev.find((a) => a.id === agent.id);
        return exists ? prev.map((a) => a.id === agent.id ? agent : a) : [...prev, agent];
      });
      setShowHttpAgentForm(false);
      setHttpAgentForm({ name: "", endpoint: "", method: "POST", body_template: '{"message": "{{question}}"}', response_path: "", auth_value: "" });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to add agent");
    } finally { setSavingHttpAgent(false); }
  }

  async function handleSaveBrowserAgent() {
    if (!selected || !browserAgentForm.name.trim() || !browserAgentForm.url.trim()) return;
    setSavingBrowserAgent(true);
    try {
      const agent = await api.createAgent(selected.id, {
        name: browserAgentForm.name.trim(),
        developer_name: browserAgentForm.name.trim(),
        agent_type: "browser",
        config: {
          url: browserAgentForm.url.trim(),
          input_selector: browserAgentForm.input_selector.trim(),
          send_selector: browserAgentForm.send_selector.trim(),
          response_selector: browserAgentForm.response_selector.trim(),
          iframe_selector: browserAgentForm.iframe_selector.trim() || undefined,
          wait_after_send_ms: parseInt(browserAgentForm.wait_after_send_ms) || 5000,
          load_wait_ms: parseInt(browserAgentForm.load_wait_ms) || 2000,
        },
      });
      setAgents((prev) => {
        const exists = prev.find((a) => a.id === agent.id);
        return exists ? prev.map((a) => a.id === agent.id ? agent : a) : [...prev, agent];
      });
      setShowBrowserAgentForm(false);
      setBrowserAgentForm({ name: "", url: "", input_selector: "", send_selector: "", response_selector: "", iframe_selector: "", wait_after_send_ms: "5000", load_wait_ms: "2000" });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to add agent");
    } finally { setSavingBrowserAgent(false); }
  }

  async function handleScreenshot(agentId: string) {
    setTakingScreenshot(true);
    setScreenshotResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/agents/${agentId}/screenshot`);
      const data = await res.json();
      setScreenshotResult(data);
    } catch (e: unknown) {
      setScreenshotResult({ success: false, message: e instanceof Error ? e.message : "Failed" });
    } finally { setTakingScreenshot(false); }
  }

  async function handleProbe() {
    const url = browserAgentForm.url.trim();
    if (!url) { alert("Enter a Page URL first"); return; }
    setProbing(true);
    setProbeResult(null);
    try {
      const result = await api.probeBrowserUrl(url);
      setProbeResult(result);
      if (result.success && result.suggested) {
        const s = result.suggested;
        // Only overwrite a field if the probe found something for it
        setBrowserAgentForm((f) => ({
          ...f,
          ...(s.input_selector    ? { input_selector:    s.input_selector }    : {}),
          ...(s.send_selector     ? { send_selector:     s.send_selector }     : {}),
          ...(s.response_selector ? { response_selector: s.response_selector } : {}),
          ...(s.iframe_selector   ? { iframe_selector:   s.iframe_selector }   : {}),
          ...(s.load_wait_ms      ? { load_wait_ms:      String(s.load_wait_ms) } : {}),
          ...(s.wait_after_send_ms ? { wait_after_send_ms: String(s.wait_after_send_ms) } : {}),
        }));
      }
    } catch (e: unknown) {
      setProbeResult({ success: false, error: e instanceof Error ? e.message : "Probe failed" });
    } finally { setProbing(false); }
  }

  async function handleTest() {
    if (!selected) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testConnection(selected.id);
      setTestResult({
        ok: r.success,
        msg: r.success ? `Connected — ${r.agent_count} agent(s) found` : r.message,
      });
    } catch (e: unknown) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Failed" });
    } finally { setTesting(false); }
  }

  async function handleSync() {
    if (!selected) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const found = await api.syncAgents(selected.id);
      setAgents(found);
      if (found.length === 0) {
        setSyncMsg("No agents discovered automatically. Add one manually below.");
        setShowAgentForm(true);
      } else {
        setSyncMsg(`${found.length} agent(s) synced.`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setSyncMsg(msg);
      setShowAgentForm(true);
    } finally { setSyncing(false); }
  }

  async function handleDeleteConn() {
    if (!selected) return;
    if (!confirm(`Delete connection "${selected.name}" and all its agents?`)) return;
    setDeletingConn(true);
    try {
      await api.deleteConnection(selected.id);
      setConnections((prev) => prev.filter((c) => c.id !== selected.id));
      clearConnectionSelection();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally { setDeletingConn(false); }
  }

  async function handleDeleteAgent(agent: api.Agent) {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    setDeletingAgentId(agent.id);
    try {
      if (chatAgent?.id === agent.id && sessionId) {
        await api.endSession(chatAgent.id, sessionId).catch(() => {});
      }
      await api.deleteAgent(agent.id);
      setAgents((prev) => prev.filter((x) => x.id !== agent.id));
      if (chatAgent?.id === agent.id) {
        setChatAgent(null);
        setMessages([]);
        setSessionId(null);
      }
      if (manualChatAgent?.id === agent.id) {
        setManualChatAgent(null);
        setManualChatMessages([]);
        setManualChatSession(null);
        setManualChatInput("");
      }
      if (editingAgent?.id === agent.id) setEditingAgent(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to delete agent");
    } finally {
      setDeletingAgentId(null);
    }
  }

  function openEditConn() {
    if (!selected) return;
    setEditConnForm({ name: selected.name, domain: selected.domain, consumer_key: "", consumer_secret: "" });
    setShowEditConn(true);
  }

  async function handleSaveConn() {
    if (!selected) return;
    setSavingConn(true);
    try {
      const body: Record<string, string> = { name: editConnForm.name, domain: editConnForm.domain };
      if (editConnForm.consumer_key) body.consumer_key = editConnForm.consumer_key;
      if (editConnForm.consumer_secret) body.consumer_secret = editConnForm.consumer_secret;
      const updated = await api.updateConnection(selected.id, body);
      setConnections((prev) => prev.map((c) => c.id === selected.id ? updated : c));
      setSelected(updated);
      setShowEditConn(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally { setSavingConn(false); }
  }

  async function handleAddAgent() {
    if (!selected || !agentForm.salesforce_id.trim() || !agentForm.name.trim()) return;
    setSavingAgent(true);
    try {
      const agent = await api.createAgent(selected.id, {
        salesforce_id: agentForm.salesforce_id.trim(),
        name: agentForm.name.trim(),
        developer_name: agentForm.developer_name.trim() || agentForm.name.trim(),
        agent_type: "agentforce",
      });
      setAgents((prev) => {
        const exists = prev.find((a) => a.id === agent.id);
        return exists ? prev.map((a) => a.id === agent.id ? agent : a) : [...prev, agent];
      });
      setAgentForm({ salesforce_id: "", name: "", developer_name: "" });
      setShowAgentForm(false);
      setSyncMsg(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to add agent");
    } finally { setSavingAgent(false); }
  }

  async function selectAgent(a: api.Agent) {
    if (chatAgent?.id === a.id) return;
    if (chatAgent && sessionId) {
      await api.endSession(chatAgent.id, sessionId).catch(() => {});
    }
    setChatAgent(a);
    setMessages([]);
    setSessionId(null);
  }

  async function sendMessage() {
    if (!chatAgent || !input.trim() || chatLoading) return;
    const text = input.trim();
    setInput("");
    setChatLoading(true);
    setMessages((m) => [...m, { role: "user", text }]);
    try {
      const r = await api.chatWithAgent(chatAgent.id, text, sessionId ?? undefined);
      setSessionId(r.session_id);
      setMessages((m) => [...m, { role: "agent", text: r.response }]);
    } catch (e: unknown) {
      setMessages((m) => [...m, { role: "error", text: e instanceof Error ? e.message : "Error" }]);
    } finally { setChatLoading(false); }
  }

  async function handleEndSession() {
    if (!chatAgent || !sessionId) return;
    await api.endSession(chatAgent.id, sessionId).catch(() => {});
    setSessionId(null);
    setMessages([]);
  }

  async function handleDescribe(name: string) {
    if (!selected) return;
    setDescribingObj(name);
    setDescribeResult(null);
    try {
      const r = await api.describeSObject(selected.id, name);
      setDescribeResult(r);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Describe failed");
    } finally { setDescribingObj(null); }
  }

  async function handleRunSoql(q?: string) {
    if (!selected) return;
    const query = q ?? soqlQuery;
    if (q) setSoqlQuery(q);
    setRunningSoql(true);
    setSoqlResult(null);
    try {
      const r = await api.runSoql(selected.id, query);
      setSoqlResult(r);
    } catch (e: unknown) {
      setSoqlResult({ ok: false, error: e instanceof Error ? e.message : "Failed" });
    } finally { setRunningSoql(false); }
  }

  function openEditAgent(a: api.Agent) {
    setEditingAgent(a);
    setEditAgentForm({
      salesforce_id: a.salesforce_id,
      name: a.name,
      developer_name: a.developer_name,
      runtime_url: a.runtime_url ?? "",
    });
  }

  async function handleSaveAgent() {
    if (!editingAgent) return;
    setSavingEditAgent(true);
    try {
      const updated = await api.updateAgent(editingAgent.id, {
        salesforce_id: editAgentForm.salesforce_id.trim(),
        name: editAgentForm.name.trim(),
        developer_name: editAgentForm.developer_name.trim() || editAgentForm.name.trim(),
        runtime_url: editAgentForm.runtime_url.trim() || null,
      });
      setAgents((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      if (chatAgent?.id === updated.id) setChatAgent(updated);
      if (manualChatAgent?.id === updated.id) setManualChatAgent(updated);
      setEditingAgent(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally { setSavingEditAgent(false); }
  }

  async function handleManualChat() {
    if (!manualChatAgent || !manualChatInput.trim() || manualChatLoading) return;
    const text = manualChatInput.trim();
    setManualChatInput("");
    setManualChatLoading(true);
    setManualChatMessages((m) => [...m, { role: "user", text }]);
    try {
      const r = await api.manualChat(manualChatAgent.id, text, manualChatSession ?? undefined);
      setManualChatSession(r.session_id);
      const meta = r.new_session ? `New session created. Agent ID: ${r.agent_id_used}` : undefined;
      setManualChatMessages((m) => [...m, { role: "agent", text: r.response, meta }]);
    } catch (e: unknown) {
      setManualChatMessages((m) => [...m, {
        role: "error",
        text: e instanceof Error ? e.message : "Error",
      }]);
    } finally { setManualChatLoading(false); }
  }

  async function handleDiscoverEndpoints() {
    if (!selected) return;
    setDiscoveringEndpoints(true);
    setEndpointResult(null);
    try {
      const r = await api.discoverEndpoints(selected.id);
      setEndpointResult(r);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Discovery failed");
    } finally { setDiscoveringEndpoints(false); }
  }

  async function handleDiscoverRuntime() {
    if (!selected) return;
    setDiscoveringRuntime(true);
    setRuntimeResult(null);
    try {
      const result = await api.discoverRuntimeIds(selected.id);
      setRuntimeResult(result);
    } catch (e: unknown) {
      setRuntimeResult({ agents: [], errors: [e instanceof Error ? e.message : "Discovery failed"], instructions: "" });
    } finally { setDiscoveringRuntime(false); }
  }

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  function clearConnectionSelection() {
    setSelected(null);
    setSelectedConnId(null);
    setAgents([]);
    setChatAgent(null);
    setMessages([]);
    setSessionId(null);
    setTestResult(null);
    setManualChatAgent(null);
    setManualChatMessages([]);
    setManualChatSession(null);
    setManualChatInput("");
    setEditingAgent(null);
  }

  const sortedConnections = [...connections].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  // ── Resizable panel ────────────────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(320); // px
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [leftWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const delta = e.clientX - dragStartX.current;
      const containerW = containerRef.current.getBoundingClientRect().width;
      const next = Math.min(Math.max(dragStartWidth.current + delta, 200), containerW - 320);
      setLeftWidth(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Connections table rows & columns
  const connTableRows = sortedConnections.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.connection_type ?? "salesforce",
    domain: c.connection_type === "http" ? "HTTP API" : c.domain || "Salesforce",
    _conn: c,
  }));

  const connTableColumns: TstAgntColumnConfig<typeof connTableRows[number]>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      renderCell: (value, row) => (
        <span className={`font-medium text-sm ${selected?.id === row._conn.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-900 dark:text-white"}`}>
          {String(value)}
        </span>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      renderCell: (value) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
          value === "http"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            : value === "browser"
            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
            : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
        }`}>
          {value === "http" ? "🌐" : value === "browser" ? "🤖" : "⚡"} {String(value)}
        </span>
      ),
    },
    {
      key: "domain",
      label: "Domain / URL",
      searchable: true,
      renderCell: (value) => (
        <span className="text-xs text-gray-400 truncate max-w-[160px] block">{String(value || "—")}</span>
      ),
    },
  ];

  // Agents table data & columns (computed outside JSX to avoid IIFE + TS type in JSX)
  const agentTableRows = agents.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.agent_type ?? "salesforce",
    identifier:
      a.agent_type === "http"
        ? ((a.config as api.HttpAgentConfig)?.endpoint ?? "")
        : a.agent_type === "browser"
        ? (((a.config as Record<string, unknown>)?.url as string) ?? "")
        : (a.salesforce_id ?? ""),
    _agent: a,
  }));

  const agentTableColumns: TstAgntColumnConfig<typeof agentTableRows[number]>[] = [
    { key: "name", label: "Name", sortable: true, searchable: true },
    {
      key: "type",
      label: "Type",
      sortable: true,
      renderCell: (value) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
            value === "http"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : value === "browser"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
              : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
          }`}
        >
          {String(value)}
        </span>
      ),
    },
    {
      key: "identifier",
      label: "ID / Endpoint",
      searchable: true,
      renderCell: (value) => (
        <span className="font-mono text-[10px] text-gray-400 truncate max-w-[180px] block">
          {String(value || "—")}
        </span>
      ),
    },
    {
      key: "id",
      label: "Actions",
      renderCell: (_value, row) => {
        const a = row._agent;
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); openEditAgent(a); }}
              className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500"
            >
              Edit
            </button>
            {a.agent_type === "browser" ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleScreenshot(a.id); }}
                disabled={takingScreenshot}
                title="Take a screenshot to verify the page loads"
                className="text-xs px-2 py-1 border border-purple-300 dark:border-purple-700 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 disabled:opacity-50"
              >
                {takingScreenshot ? "..." : "📸"}
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setManualChatAgent(a); setManualChatMessages([]); setManualChatSession(null); setEditingAgent(null); }}
                title="Manually send questions one at a time"
                className="text-xs px-2 py-1 border border-orange-300 dark:border-orange-700 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400"
              >
                Test
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void handleDeleteAgent(a); }}
              disabled={deletingAgentId === a.id}
              title="Remove this agent"
              className="text-xs px-2 py-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 disabled:opacity-50"
            >
              {deletingAgentId === a.id ? "…" : "Delete"}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Connections</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 shrink-0"
        >
          {showForm ? "✕ Close" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <div className="shrink-0 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-2 max-w-3xl">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">New connection</p>
          <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {(["salesforce", "http", "browser"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setConnType(t)}
                className={`flex-1 text-xs py-1 rounded-md font-medium transition-colors ${connType === t ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"}`}
              >
                {t === "salesforce" ? "⚡ Salesforce" : t === "http" ? "🌐 HTTP API" : "🤖 Browser"}
              </button>
            ))}
          </div>

          <input placeholder="Connection Name" value={form.name} onChange={field("name")} className={INPUT_CLS} />

          {connType === "salesforce" ? (
            <>
              <input placeholder="Domain (e.g. org.my.salesforce.com)" value={form.domain} onChange={field("domain")} className={INPUT_CLS} />
              <input placeholder="Consumer Key" value={form.consumer_key} onChange={field("consumer_key")} className={INPUT_CLS} />
              <input type="password" placeholder="Consumer Secret" value={form.consumer_secret} onChange={field("consumer_secret")} className={INPUT_CLS} />
            </>
          ) : connType === "http" ? (
            <>
              <select value={httpForm.auth_type} onChange={(e) => setHttpForm((f) => ({ ...f, auth_type: e.target.value }))} className={INPUT_CLS}>
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key (header)</option>
                <option value="basic">Basic Auth</option>
              </select>
              {httpForm.auth_type !== "none" && (
                <input
                  placeholder={httpForm.auth_type === "bearer" ? "Token value (without 'Bearer ')" : httpForm.auth_type === "basic" ? "user:password" : "API key value"}
                  value={httpForm.auth_value}
                  onChange={(e) => setHttpForm((f) => ({ ...f, auth_value: e.target.value }))}
                  className={INPUT_CLS}
                />
              )}
              <input
                placeholder="Test URL (optional — used for Test Connection)"
                value={httpForm.test_url}
                onChange={(e) => setHttpForm((f) => ({ ...f, test_url: e.target.value }))}
                className={INPUT_CLS}
              />
              <p className="text-[10px] text-gray-400">Add agents after saving to configure individual endpoint URLs.</p>
            </>
          ) : (
            <>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">No API key needed — drives a real browser to interact with any chat widget.</p>
              <p className="text-[10px] text-gray-400">Save the connection, then add agents with the target URL and CSS selectors.</p>
            </>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-xs bg-indigo-600 text-white py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 text-xs text-gray-600 dark:text-gray-400 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Master-detail split */}
      <div ref={containerRef} className="flex-1 flex min-h-0 min-w-0">

        {/* LEFT: Connections list */}
        <div
          className={`${selected ? "hidden md:flex" : "flex"} flex-col shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900`}
          style={{ width: leftWidth }}
        >
          <div className="flex-1 overflow-y-auto p-3">
            <TstAgntTable
              data={connTableRows}
              columns={connTableColumns}
              enableSearch={true}
              searchPlaceholder="Search connections..."
              pagination={{ enabled: true, rowsPerPage: 10 }}
              onRowClick={(row) => void selectConnection(row._conn)}
              selectedRowId={selected?.id ?? null}
              emptyState={
                <p className="text-xs text-gray-400 py-4">
                  No connections yet — use <strong>+ Add</strong> above to create one.
                </p>
              }
            />
          </div>
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="hidden md:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center group hover:bg-indigo-100 dark:hover:bg-indigo-900/30 active:bg-indigo-200 dark:active:bg-indigo-800/40 transition-colors"
          title="Drag to resize"
        >
          <div className="w-px h-8 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 transition-colors" />
        </div>

        {/* RIGHT: Detail panel */}
        <div className={`${selected ? "flex" : "hidden md:flex"} flex-1 flex-col min-h-0 min-w-0`}>
        {selected ? (
          <>
            {/* Connection header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0">
              <button
                onClick={clearConnectionSelection}
                className="md:hidden mr-2 p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Back to list"
              >
                ←
              </button>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{selected.name}</h3>
                <p className="text-xs text-gray-400">{selected.domain}</p>
                {testResult && (
                  <p className={`text-xs mt-1 ${testResult.ok ? "text-green-600" : "text-red-500"}`}>
                    {testResult.ok ? "Connected —" : "Failed —"} {testResult.msg}
                  </p>
                )}
                {syncMsg && (
                  <p className={`text-xs mt-1 ${syncMsg.includes("synced") ? "text-green-600" : "text-amber-500"}`}>
                    {syncMsg}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                >
                  {testing ? "Testing..." : "Test Connection"}
                </button>
                {selected?.connection_type === "salesforce" && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {syncing ? "Syncing..." : "Sync Agents"}
                  </button>
                )}
                {selected?.connection_type === "salesforce" && (
                  <button
                    onClick={() => setShowAgentForm((v) => !v)}
                    className="text-xs px-3 py-1.5 border border-dashed border-gray-400 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                  >
                    + Add Agent
                  </button>
                )}
                <button
                  onClick={openEditConn}
                  className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteConn}
                  disabled={deletingConn}
                  className="text-xs px-3 py-1.5 text-red-500 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
                >
                  {deletingConn ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>

            {/* ── Scrollable content area ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

            {/* Edit connection form */}
            {showEditConn && (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Edit Connection</p>
                <div className="flex flex-col gap-2 max-w-md">
                  <input placeholder="Name" value={editConnForm.name} onChange={(e) => setEditConnForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                  <input placeholder="Domain" value={editConnForm.domain} onChange={(e) => setEditConnForm((f) => ({ ...f, domain: e.target.value }))} className={INPUT_CLS} />
                  <input placeholder="New Consumer Key (leave blank to keep current)" value={editConnForm.consumer_key} onChange={(e) => setEditConnForm((f) => ({ ...f, consumer_key: e.target.value }))} className={INPUT_CLS} />
                  <input type="password" placeholder="New Consumer Secret (leave blank to keep current)" value={editConnForm.consumer_secret} onChange={(e) => setEditConnForm((f) => ({ ...f, consumer_secret: e.target.value }))} className={INPUT_CLS} />
                  <div className="flex gap-2">
                    <button onClick={handleSaveConn} disabled={savingConn} className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                      {savingConn ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setShowEditConn(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Agents Table */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
              <TstAgntTable
                data={agentTableRows}
                columns={agentTableColumns}
                tableTitle={`Agents (${agents.length})`}
                enableSearch={true}
                searchPlaceholder="Search agents..."
                pagination={{ enabled: true, rowsPerPage: 10 }}
                onRowClick={(row) => selectAgent(row._agent)}
                emptyState={
                  <p className="text-xs text-gray-400">
                    No agents yet — add one below.
                  </p>
                }
              />
            </div>

            {/* Screenshot result */}
            {screenshotResult && (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-purple-50 dark:bg-purple-950/20 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs font-medium ${screenshotResult.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {screenshotResult.success ? "✅" : "❌"} {screenshotResult.message}
                  </p>
                  <button onClick={() => setScreenshotResult(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
                {screenshotResult.screenshot_b64 && (
                  <img
                    src={`data:image/png;base64,${screenshotResult.screenshot_b64}`}
                    alt="Page screenshot"
                    className="rounded border border-gray-200 dark:border-gray-700 max-w-full"
                  />
                )}
              </div>
            )}

            {/* Edit agent form */}
            {editingAgent && (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-blue-50 dark:bg-blue-950/20 shrink-0">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                  Edit Agent — {editingAgent.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  The <strong>Salesforce ID</strong> must be a real Salesforce record ID — 15 or 18 alphanumeric characters
                  (e.g. <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">0HoXXXXXXXXXXXXXXX</code>).
                  Use &quot;Auto-Discover&quot; below, or find it in Salesforce Setup → Agents → click your agent → copy ID from URL.
                </p>
                <div className="flex flex-col gap-2 max-w-lg">
                  <input
                    placeholder="Salesforce Agent ID"
                    value={editAgentForm.salesforce_id}
                    onChange={(e) => setEditAgentForm((f) => ({ ...f, salesforce_id: e.target.value }))}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Display Name"
                    value={editAgentForm.name}
                    onChange={(e) => setEditAgentForm((f) => ({ ...f, name: e.target.value }))}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Developer Name (optional)"
                    value={editAgentForm.developer_name}
                    onChange={(e) => setEditAgentForm((f) => ({ ...f, developer_name: e.target.value }))}
                    className={INPUT_CLS}
                  />
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">
                      Custom Runtime URL (optional) — override the auto-detected session endpoint
                    </label>
                    <input
                      placeholder="https://your-org.my.salesforce.com/einstein/ai-agent/v1/agents/YOUR_ID"
                      value={editAgentForm.runtime_url}
                      onChange={(e) => setEditAgentForm((f) => ({ ...f, runtime_url: e.target.value }))}
                      className={INPUT_CLS}
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Leave blank to auto-detect. If the agent returns 404, paste the exact base URL here (up to but not including <code>/sessions</code>).
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAgent}
                      disabled={savingEditAgent}
                      className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingEditAgent ? "Saving..." : "Save Agent"}
                    </button>
                    <button
                      onClick={() => { setManualChatAgent(editingAgent); setManualChatMessages([]); setManualChatSession(null); setEditingAgent(null); }}
                      className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded hover:bg-orange-700"
                    >
                      Manual Chat Test
                    </button>
                    <button
                      onClick={() => setEditingAgent(null)}
                      className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Chat Test Panel */}
            {manualChatAgent && (
              <div className="px-4 py-3 border-b border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                      Manual Chat Test — {manualChatAgent.name}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Send questions one at a time to verify the agent is reachable.
                      {manualChatAgent.runtime_url && (
                        <span className="ml-1 text-green-600 dark:text-green-400">Custom URL set ✓</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => { setManualChatAgent(null); setManualChatSession(null); setManualChatMessages([]); }}
                    className="text-xs text-gray-400 hover:text-gray-600 ml-2"
                  >✕ Close</button>
                </div>

                {/* Message history */}
                {manualChatMessages.length > 0 && (
                  <div className="max-h-48 overflow-y-auto bg-white dark:bg-gray-900 rounded border border-orange-200 dark:border-orange-800 p-2 mb-2 space-y-2">
                    {manualChatMessages.map((m, i) => (
                      <div key={i} className={`text-xs ${m.role === "user" ? "text-indigo-700 dark:text-indigo-300" : m.role === "error" ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}`}>
                        <span className="font-medium mr-1">{m.role === "user" ? "You:" : m.role === "error" ? "Error:" : "Agent:"}</span>
                        <span className="whitespace-pre-wrap">{m.text}</span>
                        {m.meta && <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">{m.meta}</p>}
                      </div>
                    ))}
                    <div ref={manualChatEndRef} />
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-2">
                  <input
                    value={manualChatInput}
                    onChange={(e) => setManualChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleManualChat(); } }}
                    placeholder="Type your question and press Enter…"
                    disabled={manualChatLoading}
                    className={INPUT_CLS + " flex-1"}
                  />
                  <button
                    onClick={handleManualChat}
                    disabled={manualChatLoading || !manualChatInput.trim()}
                    className="text-xs bg-orange-600 text-white px-4 py-1.5 rounded hover:bg-orange-700 disabled:opacity-50 shrink-0"
                  >
                    {manualChatLoading ? "Sending…" : "Send"}
                  </button>
                  {manualChatSession && (
                    <button
                      onClick={() => { setManualChatSession(null); setManualChatMessages([]); }}
                      className="text-xs text-gray-500 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
                      title="Start a new session"
                    >
                      New Session
                    </button>
                  )}
                </div>

                {!manualChatAgent.runtime_url && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    No custom runtime URL set. If this fails with 404, click <strong>Edit</strong> on the agent and paste the correct URL in the &quot;Custom Runtime URL&quot; field.
                  </p>
                )}
              </div>
            )}

            {/* Endpoint Discovery */}
            <div className="px-4 py-3 border-b border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 shrink-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">Diagnose — Discover Available Endpoints</span>
                <button
                  onClick={handleDiscoverEndpoints}
                  disabled={discoveringEndpoints}
                  className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {discoveringEndpoints ? "Probing…" : "Run Diagnostic"}
                </button>
                {endpointResult && (
                  <button onClick={() => setEndpointResult(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Clear</button>
                )}
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                Probes every known Salesforce AgentForce API path to find which one works on this org.
              </p>

              {endpointResult && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {endpointResult.probes.map((p, i) => (
                    <div key={i} className={`rounded px-2 py-1.5 text-[10px] font-mono border ${p.ok ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${p.ok ? "text-green-700 dark:text-green-400" : p.status === 0 ? "text-gray-400" : p.status === 404 ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"}`}>
                          {p.status === 0 ? "ERR" : p.status}
                        </span>
                        <span className={`font-medium ${p.ok ? "text-green-800 dark:text-green-300" : "text-gray-600 dark:text-gray-400"}`}>{p.label}</span>
                      </div>
                      {p.ok && (
                        <div className="mt-0.5 text-green-700 dark:text-green-300 whitespace-pre-wrap break-all">
                          {typeof p.data === "string" ? p.data : JSON.stringify(p.data).slice(0, 400)}
                        </div>
                      )}
                      {!p.ok && p.status !== 0 && (
                        <div className="text-gray-400 break-all truncate">
                          {typeof p.data === "string" ? p.data : JSON.stringify(p.data).slice(0, 200)}
                        </div>
                      )}
                      <div className="text-gray-300 dark:text-gray-600 truncate">{p.url}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Runtime ID Discovery */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Find correct Agent ID</span>
                <button
                  onClick={handleDiscoverRuntime}
                  disabled={discoveringRuntime}
                  className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {discoveringRuntime ? "Searching…" : "Auto-Discover"}
                </button>
              </div>

              {runtimeResult && (
                <div className="mt-2 flex flex-col gap-2">
                  {runtimeResult.agents.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {runtimeResult.agents.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-emerald-800 dark:text-emerald-300">{r.name}</span>
                            <code className="font-mono text-emerald-700 dark:text-emerald-400 ml-2">{r.id}</code>
                            <span className="text-gray-400 ml-1">({r.source})</span>
                          </div>
                          <button
                            onClick={() => {
                              const agent = agents.find((a) => a.name === r.name);
                              if (agent) openEditAgent({ ...agent, salesforce_id: r.id });
                              else {
                                setEditAgentForm({ salesforce_id: r.id, name: r.name, developer_name: r.developer_name, runtime_url: "" });
                                setShowAgentForm(true);
                              }
                            }}
                            className="text-emerald-700 dark:text-emerald-400 underline hover:no-underline shrink-0"
                          >
                            Use this ID
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-3">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">No agents found automatically</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">{runtimeResult.instructions}</p>
                      <div className="bg-white dark:bg-gray-900 rounded p-2 text-xs text-gray-700 dark:text-gray-300 font-mono border border-gray-200 dark:border-gray-700 space-y-0.5">
                        <p>1. Open: <strong>Salesforce Setup</strong></p>
                        <p>2. Quick Find: type <strong>Agents</strong></p>
                        <p>3. Click your agent → copy the <strong>18-char ID</strong> from the URL</p>
                        <p className="text-gray-400">   URL looks like: .../0HoXXXXXXXXXXXXXXX/view</p>
                        <p>4. Click <strong>Edit</strong> next to the agent above and paste it</p>
                      </div>
                      {runtimeResult.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer">Show discovery errors</summary>
                          <div className="mt-1 space-y-0.5">
                            {runtimeResult.errors.map((e, i) => (
                              <p key={i} className="text-xs text-red-400 font-mono truncate">{e}</p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!runtimeResult && (
                <p className="text-xs text-gray-400 mt-1">
                  Tries all known Salesforce APIs. If none work, use the manual steps below.
                </p>
              )}
            </div>

            {/* Browser Agent form — shown for Browser connections */}
            {selected?.connection_type === "browser" && (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">🤖 Browser Agents</span>
                  <button
                    onClick={() => setShowBrowserAgentForm((v) => !v)}
                    className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                  >
                    + Add Page
                  </button>
                </div>

                {showBrowserAgentForm && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded p-3 mb-2 flex flex-col gap-2">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Playwright opens this page in a headless browser. Use CSS selectors to identify the chat input, send button, and response container.
                    </p>

                    <input placeholder="Agent Name (e.g. Stanford Chatbot)" value={browserAgentForm.name} onChange={(e) => setBrowserAgentForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                    <div className="flex gap-2">
                      <input
                        placeholder="Page URL (e.g. https://www.clevelandclinic.org)"
                        value={browserAgentForm.url}
                        onChange={(e) => setBrowserAgentForm((f) => ({ ...f, url: e.target.value }))}
                        className={INPUT_CLS + " flex-1"}
                      />
                      <button
                        onClick={handleProbe}
                        disabled={probing || !browserAgentForm.url.trim()}
                        title="Auto-discover chat widget selectors"
                        className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 shrink-0 flex items-center gap-1"
                      >
                        {probing ? (
                          <><span className="animate-spin">⏳</span> Scanning…</>
                        ) : (
                          <>🔍 Discover</>
                        )}
                      </button>
                    </div>
                    {probing && (
                      <p className="text-[10px] text-violet-600 dark:text-violet-400 animate-pulse">
                        Opening browser, clicking chat launcher, scanning DOM for selectors… (may take 10–20s)
                      </p>
                    )}
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Tip: If you only set the Page URL and save the agent, the server runs the same Discover crawl automatically on the first chat or test run (slower first message).
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                      <input placeholder="Input selector (e.g. input[placeholder*='message' i])" value={browserAgentForm.input_selector} onChange={(e) => setBrowserAgentForm((f) => ({ ...f, input_selector: e.target.value }))} className={INPUT_CLS + " font-mono text-[11px]"} />
                      <input placeholder="Send button selector (e.g. button[type='submit']  or  Enter)" value={browserAgentForm.send_selector} onChange={(e) => setBrowserAgentForm((f) => ({ ...f, send_selector: e.target.value }))} className={INPUT_CLS + " font-mono text-[11px]"} />
                      <input placeholder="Response selector (e.g. .bot-message  or  [data-role='bot'])" value={browserAgentForm.response_selector} onChange={(e) => setBrowserAgentForm((f) => ({ ...f, response_selector: e.target.value }))} className={INPUT_CLS + " font-mono text-[11px]"} />
                      <input placeholder="Iframe selector (leave blank if no iframe)" value={browserAgentForm.iframe_selector} onChange={(e) => setBrowserAgentForm((f) => ({ ...f, iframe_selector: e.target.value }))} className={INPUT_CLS + " font-mono text-[11px]"} />
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Wait after page load (ms)</label>
                        <input type="number" value={browserAgentForm.load_wait_ms} onChange={(e) => setBrowserAgentForm((f) => ({ ...f, load_wait_ms: e.target.value }))} className={INPUT_CLS} />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Wait for bot reply (ms)</label>
                        <input type="number" value={browserAgentForm.wait_after_send_ms} onChange={(e) => setBrowserAgentForm((f) => ({ ...f, wait_after_send_ms: e.target.value }))} className={INPUT_CLS} />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleSaveBrowserAgent} disabled={savingBrowserAgent || !browserAgentForm.name.trim() || !browserAgentForm.url.trim()} className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                        {savingBrowserAgent ? "Saving..." : "Save Agent"}
                      </button>
                      <button onClick={() => setShowBrowserAgentForm(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                    </div>

                    {/* Common selector hints */}
                    <div className="text-[10px] text-gray-400 mt-1 space-y-0.5 border-t border-gray-200 dark:border-gray-700 pt-2">
                      <p className="font-medium text-gray-500">Common selector patterns:</p>
                      {[
                        ["Chat input", "input[placeholder*='message' i]  or  textarea[placeholder*='type' i]"],
                        ["Send button", "button[type='submit']  or  Enter"],
                        ["Salesforce MIAW", ".slds-chat-listitem_inbound .slds-chat-message__text"],
                        ["Intercom", "[data-testid='message-text']"],
                        ["Generic bot msg", ".bot-message  or  [data-role='bot']  or  .assistant"],
                      ].map(([label, sel]) => (
                        <p key={label}><span className="text-gray-400">{label}:</span> <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{sel}</code></p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screenshot section — for saved agents */}
                {agents.filter((a) => a.agent_type === "browser").length > 0 && (
                  <div className="mt-1 text-[10px] text-gray-400">
                    <p>Tip: Click <strong>📸 Screenshot</strong> on a saved agent to verify the page loads correctly before running tests.</p>
                  </div>
                )}

                {/* Probe results */}
                {probeResult && (() => {
                  const found = probeResult.found_count ?? 0;
                  const hasSelectors = found > 0;
                  const color = !probeResult.success ? "red" : hasSelectors ? "violet" : "amber";
                  const bgCls = color === "red" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                    : color === "violet" ? "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800";
                  const textCls = color === "red" ? "text-red-600" : color === "violet" ? "text-violet-700 dark:text-violet-300" : "text-amber-700 dark:text-amber-400";
                  const icon = !probeResult.success ? "❌" : hasSelectors ? "✅" : "⚠️";
                  const msg = !probeResult.success
                    ? probeResult.error
                    : hasSelectors
                    ? `Found ${found}/3 selector types — form auto-filled!`
                    : "Page scanned but no chat widget selectors detected. See raw elements below to build selectors manually.";
                  return (
                  <div className={`mt-2 rounded border p-3 text-xs ${bgCls}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${textCls}`}>{icon} {msg}</span>
                      <button onClick={() => setProbeResult(null)} className="text-gray-400 hover:text-gray-600 text-[10px]">✕</button>
                    </div>

                    {probeResult.launcher_clicked && (
                      <p className="text-[10px] text-gray-500 mb-2">
                        Chat launcher clicked: <code className="bg-white dark:bg-gray-900 px-1 rounded text-[10px]">{probeResult.launcher_clicked.slice(0, 80)}</code>
                      </p>
                    )}

                    {/* Matched pattern candidates */}
                    {probeResult.candidates && (["input", "send", "response"] as const).some((c) => (probeResult.candidates![c]?.length ?? 0) > 0) && (
                      <div className="space-y-2 mb-3">
                        <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase">Matched selectors</p>
                        {(["input", "send", "response"] as const).map((cat) => {
                          const cands = probeResult.candidates![cat];
                          if (!cands?.length) return null;
                          return (
                            <div key={cat}>
                              <p className="text-[10px] font-medium text-gray-500 mb-0.5">{cat}</p>
                              <div className="space-y-0.5">
                                {cands.slice(0, 3).map((c, i) => (
                                  <div key={i} className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded px-2 py-1">
                                    <code className="text-[10px] flex-1 truncate text-violet-700 dark:text-violet-300">{c.selector}</code>
                                    {c.placeholder && <span className="text-[10px] text-gray-400 shrink-0 truncate max-w-[100px]">"{c.placeholder}"</span>}
                                    <button onClick={() => { const key = cat === "input" ? "input_selector" : cat === "send" ? "send_selector" : "response_selector"; setBrowserAgentForm((f) => ({ ...f, [key]: c.selector })); }} className="text-[10px] text-violet-600 hover:underline shrink-0">Use</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Raw dump — all actual inputs/buttons found in page */}
                    {probeResult.raw_dump && Object.keys(probeResult.raw_dump).length > 0 && (
                      <details className="mb-3">
                        <summary className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer mb-1">
                          Raw page elements (expand to build selectors manually)
                        </summary>
                        <div className="space-y-2 mt-1 max-h-64 overflow-y-auto">
                          {Object.entries(probeResult.raw_dump).map(([label, data]) => (
                            (data.inputs.length > 0 || data.buttons.length > 0) && (
                              <div key={label} className="bg-white dark:bg-gray-900 rounded p-2">
                                <p className="text-[10px] font-medium text-gray-500 mb-1 truncate">
                                  {data.iframe_sel ? `📦 ${data.iframe_sel}` : "📄 Main page"}
                                </p>
                                {data.inputs.map((inp, i) => {
                                  const ph = inp.attrs.placeholder || inp.attrs["aria-label"] || inp.attrs.name || "";
                                  const id = inp.attrs.id ? `${inp.tag.toLowerCase()}#${inp.attrs.id}` : null;
                                  const nameA = inp.attrs.name ? `${inp.tag.toLowerCase()}[name='${inp.attrs.name}']` : null;
                                  const sel = id || nameA || inp.tag.toLowerCase();
                                  return (
                                    <div key={i} className="flex items-center gap-2 py-0.5">
                                      <code className="text-[10px] flex-1 truncate text-blue-600 dark:text-blue-400">{sel}</code>
                                      {ph && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">"{ph}"</span>}
                                      <button onClick={() => setBrowserAgentForm((f) => ({ ...f, input_selector: sel }))} className="text-[10px] text-violet-600 hover:underline shrink-0">→ Input</button>
                                    </div>
                                  );
                                })}
                                {data.buttons.map((btn, i) => {
                                  const label2 = btn.attrs["aria-label"] || btn.attrs.title || btn.text || btn.attrs.id || "";
                                  const id = btn.attrs.id ? `button#${btn.attrs.id}` : null;
                                  const sel = id || (label2 ? `button[aria-label='${label2}']` : "button");
                                  if (!label2 && !btn.attrs.id) return null;
                                  return (
                                    <div key={i} className="flex items-center gap-2 py-0.5">
                                      <code className="text-[10px] flex-1 truncate text-green-600 dark:text-green-400">{sel}</code>
                                      {label2 && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">"{label2}"</span>}
                                      <button onClick={() => setBrowserAgentForm((f) => ({ ...f, send_selector: sel }))} className="text-[10px] text-violet-600 hover:underline shrink-0">→ Send</button>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Probe log */}
                    {probeResult.log && (
                      <details className="mb-2">
                        <summary className="text-[10px] text-gray-400 cursor-pointer">Scan log</summary>
                        <div className="mt-1 font-mono text-[9px] text-gray-500 space-y-0.5">
                          {probeResult.log.map((l, i) => <p key={i}>{l}</p>)}
                        </div>
                      </details>
                    )}

                    {/* Screenshot */}
                    {probeResult.screenshot_b64 && (
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Screenshot:</p>
                        <img src={`data:image/png;base64,${probeResult.screenshot_b64}`} alt="Probe screenshot" className="rounded border border-gray-200 dark:border-gray-700 max-w-full" />
                      </div>
                    )}
                  </div>
                  );
                })()}
              </div>
            )}

            {/* HTTP Agent form — shown for HTTP connections */}
            {selected?.connection_type === "http" && (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">🌐 HTTP Agents</span>
                  <button
                    onClick={() => setShowHttpAgentForm((v) => !v)}
                    className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                  >
                    + Add Endpoint
                  </button>
                </div>

                {showHttpAgentForm && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded p-3 mb-2 flex flex-col gap-2">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Configure one endpoint per agent. Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{{question}}"}</code> in the body template as the placeholder for the question text.
                    </p>
                    <input placeholder="Agent Name (e.g. Phoenix Chat)" value={httpAgentForm.name} onChange={(e) => setHttpAgentForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                    <input placeholder="Endpoint URL (e.g. https://api.example.com/chat)" value={httpAgentForm.endpoint} onChange={(e) => setHttpAgentForm((f) => ({ ...f, endpoint: e.target.value }))} className={INPUT_CLS} />
                    <div className="flex gap-2">
                      <select value={httpAgentForm.method} onChange={(e) => setHttpAgentForm((f) => ({ ...f, method: e.target.value }))} className={INPUT_CLS + " w-24"}>
                        <option>POST</option><option>GET</option><option>PUT</option>
                      </select>
                      <input placeholder="Response path (e.g. reply.text or choices.0.message.content)" value={httpAgentForm.response_path} onChange={(e) => setHttpAgentForm((f) => ({ ...f, response_path: e.target.value }))} className={INPUT_CLS + " flex-1"} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">Request Body Template</label>
                      <textarea
                        rows={3}
                        value={httpAgentForm.body_template}
                        onChange={(e) => setHttpAgentForm((f) => ({ ...f, body_template: e.target.value }))}
                        className={INPUT_CLS + " font-mono text-[10px] resize-y"}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveHttpAgent} disabled={savingHttpAgent || !httpAgentForm.name.trim() || !httpAgentForm.endpoint.trim()} className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                        {savingHttpAgent ? "Saving..." : "Save Agent"}
                      </button>
                      <button onClick={() => setShowHttpAgentForm(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Common response path examples */}
                <div className="text-[10px] text-gray-400 space-y-0.5">
                  <p className="font-medium text-gray-500 dark:text-gray-400">Common response paths:</p>
                  {[
                    ["OpenAI Chat", "choices.0.message.content"],
                    ["Simple reply", "reply"],
                    ["Nested text", "data.response.text"],
                    ["Array first", "messages.0.text"],
                  ].map(([label, path]) => (
                    <p key={label} className="font-mono">
                      <span className="text-gray-400">{label}:</span>{" "}
                      <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{path}</code>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Manual agent add form — Salesforce only */}
            {showAgentForm && selected?.connection_type === "salesforce" && (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-amber-50 dark:bg-amber-950/20 shrink-0">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
                  Add Agent Manually
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Find the Agent ID in Salesforce Setup → Agents → select your agent → copy the ID from the URL or record detail.
                </p>
                <div className="flex flex-col gap-2 max-w-md">
                  <input
                    placeholder="Salesforce Agent ID (e.g. 0Xx...)"
                    value={agentForm.salesforce_id}
                    onChange={(e) => setAgentForm((f) => ({ ...f, salesforce_id: e.target.value }))}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Display Name (e.g. My AgentForce Bot)"
                    value={agentForm.name}
                    onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Developer Name (optional)"
                    value={agentForm.developer_name}
                    onChange={(e) => setAgentForm((f) => ({ ...f, developer_name: e.target.value }))}
                    className={INPUT_CLS}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddAgent}
                      disabled={savingAgent || !agentForm.salesforce_id.trim() || !agentForm.name.trim()}
                      className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingAgent ? "Saving..." : "Save Agent"}
                    </button>
                    <button
                      onClick={() => { setShowAgentForm(false); setSyncMsg(null); }}
                      className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SOQL Diagnostic — Salesforce only */}
            {selected?.connection_type === "salesforce" && <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 shrink-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                SOQL Query — inspect your Salesforce org directly
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  value={soqlQuery}
                  onChange={(e) => setSoqlQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRunSoql(); }}
                  className="flex-1 text-xs font-mono px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => handleRunSoql()}
                  disabled={runningSoql}
                  className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                >
                  {runningSoql ? "Running…" : "Run"}
                </button>
              </div>

              {/* Describe buttons */}
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-[10px] text-gray-400 self-center">Describe fields:</span>
                {["BotDefinition", "GenAiPlanner", "BotVersion"].map((obj) => (
                  <button
                    key={obj}
                    onClick={() => handleDescribe(obj)}
                    disabled={describingObj === obj}
                    className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40 disabled:opacity-40"
                  >
                    {describingObj === obj ? "…" : obj}
                  </button>
                ))}
              </div>

              {describeResult && (
                <div className="mb-2 bg-purple-50 dark:bg-purple-950/20 rounded p-2">
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                    {describeResult.sobject} fields ({describeResult.fields.length}){describeResult.note ? ` — ${describeResult.note}` : ""}:
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {describeResult.fields.map((f) => (
                      <span key={f.name} className="text-[10px] font-mono bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30"
                        title={`${f.label} (${f.type})`}
                        onClick={() => setSoqlQuery(`SELECT Id, MasterLabel, DeveloperName, ${f.name} FROM ${describeResult.sobject}`)}
                      >
                        {f.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Click any field name to add it to the SOQL query</p>
                </div>
              )}

              {/* Quick queries */}
              <div className="flex flex-wrap gap-1 mb-2">
                {[
                  ["BotDefinition", "SELECT Id,MasterLabel,DeveloperName FROM BotDefinition"],
                  ["GenAiPlanner", "SELECT Id,MasterLabel,DeveloperName FROM GenAiPlanner"],
                  ["BotVersion", "SELECT Id,MasterLabel,DeveloperName FROM BotVersion"],
                  ["AiAgent", "SELECT Id,MasterLabel,DeveloperName FROM AiAgent"],
                  ["Who am I?", "SELECT Id,Username,Name FROM User LIMIT 1"],
                ].map(([label, q]) => (
                  <button
                    key={label}
                    onClick={() => handleRunSoql(q)}
                    disabled={runningSoql}
                    className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-40"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {soqlResult && (
                <div className="mt-1">
                  {soqlResult.ok ? (
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                        {soqlResult.totalSize} record(s) found — via {soqlResult.endpoint?.split("/").slice(-2).join("/")}
                      </p>
                      {soqlResult.totalSize === 0 ? (
                        <p className="text-xs text-amber-500">
                          This object type has no records in your org. Try a different query.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="text-xs w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-100 dark:bg-gray-800">
                                {Object.keys(soqlResult.records![0]).filter(k => k !== "attributes").map(k => (
                                  <th key={k} className="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700">{k}</th>
                                ))}
                                <th className="px-2 py-1 text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {soqlResult.records!.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  {Object.entries(row).filter(([k]) => k !== "attributes").map(([k, v]) => (
                                    <td key={k} className="px-2 py-1 border border-gray-200 dark:border-gray-700 font-mono text-gray-700 dark:text-gray-300">
                                      {String(v ?? "")}
                                    </td>
                                  ))}
                                  <td className="px-2 py-1 border border-gray-200 dark:border-gray-700">
                                    {row.Id as React.ReactNode && (
                                      <div className="flex flex-col gap-0.5">
                                        {/* Update an existing saved agent with this ID */}
                                        {agents.map(a => (
                                          <button
                                            key={a.id}
                                            onClick={() => openEditAgent({ ...a, salesforce_id: String(row.Id) })}
                                            className="text-blue-600 dark:text-blue-400 underline hover:no-underline text-[10px] text-left"
                                          >
                                            Update &quot;{a.name}&quot;
                                          </button>
                                        ))}
                                        {/* Add as a brand-new agent */}
                                        <button
                                          onClick={() => {
                                            const name = String(row.MasterLabel ?? row.DeveloperName ?? "Agent");
                                            const devName = String(row.DeveloperName ?? "");
                                            setAgentForm({ salesforce_id: String(row.Id), name, developer_name: devName });
                                            setShowAgentForm(true);
                                          }}
                                          className="text-indigo-600 dark:text-indigo-400 underline hover:no-underline text-[10px] text-left"
                                        >
                                          + Add new
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-red-500">
                      Error: {typeof soqlResult.error === "string" ? soqlResult.error : JSON.stringify(soqlResult.error)}
                    </p>
                  )}
                </div>
              )}
            </div>}

            </div>{/* end scrollable content */}

            {/* Chat */}
            {chatAgent ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Chat: {chatAgent.name}
                    </span>
                    {sessionId && (
                      <span className="text-xs text-green-500">Session active</span>
                    )}
                  </div>
                  {sessionId && (
                    <button
                      onClick={handleEndSession}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      End Session
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {messages.length === 0 && (
                    <p className="text-sm text-gray-400 text-center mt-8">
                      Send a message to start a session
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-indigo-600 text-white"
                            : m.role === "error"
                            ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-sm text-gray-400">
                        Thinking...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-2 shrink-0">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message... (Enter to send)"
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={chatLoading || !input.trim()}
                    className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                {agents.length > 0
                  ? "Select an agent above to start chatting"
                  : "Click Sync Agents to load agents from Salesforce"}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-gray-400">
            <p className="hidden md:block">Select a connection from the list on the left.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
