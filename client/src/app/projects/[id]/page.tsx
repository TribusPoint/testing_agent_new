"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { usePersistedState } from "@/lib/usePersistedState";
import { INPUT_CLS, SELECT_CLS, type MainTab, type GenStep } from "../ui-constants";
import SiteAnalysisPanel from "@/components/projects/site-analysis-panel";

function ProjectDetailView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<api.Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({ name: "", description: "", company_name: "", industry: "", competitors: "", company_websites: "" });
  const [savingProject, setSavingProject] = useState(false);
  const [analysisClassicView, setAnalysisClassicView] = usePersistedState(
    `projects:analysisClassic:${projectId}`,
    false
  );
  const [siteAnalyzeLoading, setSiteAnalyzeLoading] = useState(false);
  const [analyzeUrlOverride, setAnalyzeUrlOverride] = useState("");

  const [connections, setConnections] = useState<api.Connection[]>([]);
  const [connId, setConnId] = usePersistedState(`projects:conn:${projectId}`, "");
  const [connAgents, setConnAgents] = useState<api.Agent[]>([]);
  const [genAgentId, setGenAgentId] = usePersistedState(`projects:genAgent:${projectId}`, "");

  const [personas, setPersonas] = useState<api.Persona[]>([]);
  const [dimensions, setDimensions] = useState<api.Dimension[]>([]);
  const [profiles, setProfiles] = useState<api.PersonalityProfile[]>([]);
  const [questions, setQuestions] = useState<api.Question[]>([]);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [genAllStep, setGenAllStep] = useState<string | null>(null);
  const [mainTab, setMainTab] = usePersistedState<MainTab>(`projects:detailTab:${projectId}`, "personasTab");
  const [personaGenCount, setPersonaGenCount] = useState(4);
  const [personaFormOpen, setPersonaFormOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<api.Persona | null>(null);
  const [personaForm, setPersonaForm] = useState({
    name: "",
    description: "",
    goal: "",
    personality: "",
    knowledgeLevel: "",
  });
  const [savingPersona, setSavingPersona] = useState(false);
  const [editingExpected, setEditingExpected] = useState<string | null>(null);
  const [expectedDraft, setExpectedDraft] = useState("");
  const [savingExpected, setSavingExpected] = useState(false);
  const expectedRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setProjectLoading(true);
    setLoadError(false);
    api
      .getProject(projectId)
      .then((p) => {
        if (!cancelled) setSelected(p);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setProjectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    api.listConnections().then(setConnections).catch(() => {});
  }, []);

  // Track if this is initial mount to avoid clearing persisted agent selection
  const isInitialConnMount = useRef(true);

  useEffect(() => {
    if (connId) {
      api.listAgents(connId).then(setConnAgents).catch(() => setConnAgents([]));
      // Only clear agent selection if user manually changed connection
      if (!isInitialConnMount.current) {
        setGenAgentId("");
      }
      isInitialConnMount.current = false;
    }
  }, [connId]);

  useEffect(() => {
    if (selected) loadContextData(selected.id);
  }, [selected]);

  async function handleDeleteProject() {
    if (!selected) return;
    if (!confirm(`Delete project "${selected.name}" and all its data?`)) return;
    setDeletingProject(true);
    try {
      await api.deleteProject(selected.id);
      router.replace("/projects");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingProject(false);
    }
  }

  function openEditProject() {
    if (!selected) return;
    setEditProjectForm({
      name: selected.name,
      description: selected.description ?? "",
      company_name: selected.company_name ?? "",
      industry: selected.industry ?? "",
      competitors: selected.competitors ?? "",
      company_websites: selected.company_websites ?? "",
    });
    setShowEditProject(true);
  }

  async function handleSaveProject() {
    if (!selected) return;
    setSavingProject(true);
    try {
      const updated = await api.updateProject(selected.id, {
        name: editProjectForm.name,
        description: editProjectForm.description || undefined,
        company_name: editProjectForm.company_name || undefined,
        industry: editProjectForm.industry || undefined,
        competitors: editProjectForm.competitors || undefined,
        company_websites: editProjectForm.company_websites || undefined,
      });
      setSelected(updated);
      setShowEditProject(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally { setSavingProject(false); }
  }

  async function runSiteAnalysis() {
    if (!selected) return;
    setSiteAnalyzeLoading(true);
    try {
      const trimmed = analyzeUrlOverride.trim();
      const updated = await api.analyzeProjectSite(
        selected.id,
        trimmed ? { url: trimmed } : {}
      );
      setSelected(updated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Site analysis failed");
    } finally {
      setSiteAnalyzeLoading(false);
    }
  }

  async function saveExpectedAnswer(q: api.Question) {
    if (!selected) return;
    setSavingExpected(true);
    try {
      const updated = await api.updateQuestion(selected.id, q.id, { expected_answer: expectedDraft.trim() || null });
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? updated : x)));
      setEditingExpected(null);
    } catch {}
    finally { setSavingExpected(false); }
  }

  async function loadContextData(pid: string) {
    const [p, d, pr, q] = await Promise.allSettled([
      api.listPersonas(pid),
      api.listDimensions(pid),
      api.listProfiles(pid),
      api.listQuestions(pid),
    ]);
    if (p.status === "fulfilled") setPersonas(p.value);
    if (d.status === "fulfilled") setDimensions(d.value);
    if (pr.status === "fulfilled") setProfiles(pr.value);
    if (q.status === "fulfilled") setQuestions(q.value);
  }

  async function generate(type: string) {
    if (!selected) return;
    if (type === "personas" && !genAgentId) {
      alert("Select an agent first (personas are tied to an agent).");
      return;
    }
    setGenLoading(type);
    try {
      if (type === "personas") await api.generatePersonas(selected.id, genAgentId, personaGenCount);
      else if (type === "dimensions") await api.generateDimensions(selected.id);
      else if (type === "profiles") await api.generateProfiles(selected.id);
      else if (type === "questions") await api.generateQuestions(selected.id);
      await loadContextData(selected.id);
      if (type === "personas") setMainTab("personasTab");
      else if (type === "dimensions") setMainTab("dimensionsTab");
      else if (type === "profiles") setMainTab("profilesTab");
      else if (type === "questions") setMainTab("questions");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally { setGenLoading(null); }
  }

  async function generateAll() {
    if (!selected) return;
    if (!genAgentId) {
      alert("Select an agent first (required for generating personas).");
      return;
    }
    const steps: GenStep[] = ["personas", "dimensions", "profiles", "questions"];
    setGenLoading("all");
    try {
      for (const step of steps) {
        setGenAllStep(step);
        if (step === "personas") await api.generatePersonas(selected.id, genAgentId, personaGenCount);
        else if (step === "dimensions") await api.generateDimensions(selected.id);
        else if (step === "profiles") await api.generateProfiles(selected.id);
        else if (step === "questions") await api.generateQuestions(selected.id);
        await loadContextData(selected.id);
      }
      setMainTab("questions");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenLoading(null);
      setGenAllStep(null);
    }
  }

  const GEN_STEPS: GenStep[] = ["personas", "dimensions", "profiles", "questions"];

  function openAddPersona() {
    setEditingPersona(null);
    setPersonaForm({ name: "", description: "", goal: "", personality: "", knowledgeLevel: "" });
    setPersonaFormOpen(true);
  }

  function openEditPersona(p: api.Persona) {
    setEditingPersona(p);
    setPersonaForm({
      name: p.name,
      description: p.description ?? "",
      goal: p.goal ?? "",
      personality: p.personality ?? "",
      knowledgeLevel: p.knowledge_level ?? "",
    });
    setPersonaFormOpen(true);
  }

  async function savePersona() {
    if (!selected || !personaForm.name.trim()) return;
    setSavingPersona(true);
    try {
      if (editingPersona) {
        await api.updatePersona(selected.id, editingPersona.id, {
          name: personaForm.name.trim(),
          description: personaForm.description.trim() || null,
          goal: personaForm.goal.trim() || null,
          personality: personaForm.personality.trim() || null,
          knowledge_level: personaForm.knowledgeLevel.trim() || null,
        });
      } else {
        await api.createPersona(selected.id, {
          name: personaForm.name.trim(),
          description: personaForm.description.trim() || null,
          goal: personaForm.goal.trim() || null,
          personality: personaForm.personality.trim() || null,
          knowledge_level: personaForm.knowledgeLevel.trim() || null,
          agent_id: genAgentId || null,
        });
      }
      setPersonaFormOpen(false);
      setEditingPersona(null);
      await loadContextData(selected.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally { setSavingPersona(false); }
  }

  async function removePersona(p: api.Persona) {
    if (!selected || !confirm(`Delete persona "${p.name}"?`)) return;
    try {
      await api.deletePersona(selected.id, p.id);
      await loadContextData(selected.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function clearAllPersonas() {
    if (!selected || !confirm("Remove all personas for this project?")) return;
    try {
      await api.deleteAllPersonas(selected.id);
      await loadContextData(selected.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Clear failed");
    }
  }

  async function generatePersonasOnly() {
    if (!selected || !genAgentId) {
      alert("Select a connection and agent first.");
      return;
    }
    setGenLoading("personas");
    try {
      await api.generatePersonas(selected.id, genAgentId, personaGenCount);
      await loadContextData(selected.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally { setGenLoading(null); }
  }

  function questionCountForPersona(name: string) {
    return questions.filter((q) => q.persona === name).length;
  }

  if (projectLoading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center bg-gray-50 dark:bg-gray-950 text-sm text-gray-500">
        Loading project…
      </div>
    );
  }

  if (loadError || !selected) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950 p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">Project not found.</p>
        <Link href="/projects" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/projects"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 font-medium"
          >
            ← Projects
          </Link>
          <span className="text-gray-300 dark:text-gray-600 select-none" aria-hidden>
            /
          </span>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate min-w-0">{selected.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openEditProject}
            className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            Edit project
          </button>
          <button
            type="button"
            onClick={handleDeleteProject}
            disabled={deletingProject}
            className="text-xs px-3 py-1.5 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
          >
            {deletingProject ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 sm:p-6 flex flex-col gap-4 max-w-6xl mx-auto w-full">
                {showEditProject && (
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-gray-900 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Edit project parameters</h2>
                      <button
                        type="button"
                        onClick={() => setShowEditProject(false)}
                        className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                      >
                        Close
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                      Name, company, industry, websites, competitors, and description are used for generation and site analysis.
                    </p>
                    <div className="flex flex-col gap-2 max-w-xl">
                      <input placeholder="Project name *" value={editProjectForm.name} onChange={(e) => setEditProjectForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                      <input placeholder="Company name" value={editProjectForm.company_name} onChange={(e) => setEditProjectForm((f) => ({ ...f, company_name: e.target.value }))} className={INPUT_CLS} />
                      <input placeholder="Industry" value={editProjectForm.industry} onChange={(e) => setEditProjectForm((f) => ({ ...f, industry: e.target.value }))} className={INPUT_CLS} />
                      <input placeholder="Websites (URLs, comma or space separated)" value={editProjectForm.company_websites} onChange={(e) => setEditProjectForm((f) => ({ ...f, company_websites: e.target.value }))} className={INPUT_CLS} />
                      <input placeholder="Competitors" value={editProjectForm.competitors} onChange={(e) => setEditProjectForm((f) => ({ ...f, competitors: e.target.value }))} className={INPUT_CLS} />
                      <textarea placeholder="Description" rows={3} value={editProjectForm.description} onChange={(e) => setEditProjectForm((f) => ({ ...f, description: e.target.value }))} className={INPUT_CLS + " resize-none"} />
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={handleSaveProject} disabled={savingProject || !editProjectForm.name.trim()} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          {savingProject ? "Saving…" : "Save changes"}
                        </button>
                        <button type="button" onClick={() => setShowEditProject(false)} className="text-xs text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "PERSONAS", value: personas.length },
                    { label: "DIMENSIONS", value: dimensions.length },
                    { label: "PROFILES", value: profiles.length },
                    { label: "QUESTIONS", value: questions.length },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 shadow-sm"
                    >
                      <p className="text-[10px] font-semibold tracking-wide text-gray-400 dark:text-gray-500">{card.label}</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{card.value}</p>
                    </div>
                  ))}
                </div>

                {/* Main tabs */}
                <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800 pb-px">
                  {(
                    [
                      { id: "analysis" as const, label: "Analysis" },
                      { id: "personasTab" as const, label: "Personas" },
                      { id: "dimensionsTab" as const, label: "Dimensions" },
                      { id: "profilesTab" as const, label: "Profiles" },
                      { id: "questions" as const, label: "Questions" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMainTab(t.id)}
                      className={`px-3 sm:px-4 py-2 text-xs font-medium rounded-t-md transition-colors ${
                        mainTab === t.id
                          ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border border-b-0 border-gray-200 dark:border-gray-700 -mb-px"
                          : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ── Analysis tab ── */}
                {mainTab === "analysis" && (
                  <>
                    {!analysisClassicView ? (
                      <SiteAnalysisPanel
                        project={selected}
                        analysis={selected.site_analysis ?? null}
                        loading={siteAnalyzeLoading}
                        overrideUrl={analyzeUrlOverride}
                        onOverrideUrlChange={setAnalyzeUrlOverride}
                        onAnalyze={runSiteAnalysis}
                        onClassicView={() => setAnalysisClassicView(true)}
                      />
                    ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setAnalysisClassicView(false)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      >
                        Site analysis view
                      </button>
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Project details</h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                        To change the project name, websites, or company fields, use <strong>Edit project</strong> in the top bar.
                      </p>
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {(
                          [
                            ["Description", selected.description],
                            ["Company", selected.company_name],
                            ["Industry", selected.industry],
                            ["Websites", selected.company_websites],
                            ["Competitors", selected.competitors],
                          ] as [string, string | null][]
                        )
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <div key={k} className={k === "Description" ? "col-span-2" : ""}>
                              <dt className="text-xs text-gray-400">{k}</dt>
                              <dd className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{v}</dd>
                            </div>
                          ))}
                      </dl>
                    </div>

                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Generate context</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                        Select connection and agent for <strong>personas</strong> only. Dimensions, profiles, and questions are project-wide (no connection needed). Use the other tabs to review generated data.
                      </p>
                      <div className="flex gap-2 mb-4 flex-wrap">
                        <select value={connId} onChange={(e) => setConnId(e.target.value)} className={SELECT_CLS}>
                          <option value="">Select Connection</option>
                          {connections.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <select
                          value={genAgentId}
                          onChange={(e) => setGenAgentId(e.target.value)}
                          disabled={!connId}
                          className={`${SELECT_CLS} disabled:opacity-50`}
                        >
                          <option value="">Select Agent</option>
                          {connAgents.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 flex-wrap items-center">
                        <button
                          type="button"
                          onClick={() => generateAll()}
                          disabled={genLoading !== null}
                          className="text-xs px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold"
                        >
                          {genLoading === "all" ? `Generating ${genAllStep}...` : "Gen All"}
                        </button>
                        <span className="hidden sm:inline border-l border-gray-300 dark:border-gray-600 h-6 mx-1" />
                        {GEN_STEPS.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => generate(type)}
                            disabled={genLoading !== null}
                            className="text-xs px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 capitalize"
                          >
                            {genLoading === type ? "Generating..." : `Gen ${type}`}
                          </button>
                        ))}
                      </div>
                      {genLoading && (
                        <p className="text-xs text-gray-400 mt-2">
                          {genLoading === "all"
                            ? `Generating all (${genAllStep})... this may take 1–2 minutes.`
                            : `Generating ${genLoading}... this may take 15–30 seconds.`}
                        </p>
                      )}
                    </div>
                  </div>
                    )}
                  </>
                )}

                {/* ── Personas tab ── */}
                {mainTab === "personasTab" && (
                  <div className="flex flex-col gap-6">
                    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h3 className="text-xs font-bold tracking-wide text-gray-500 dark:text-gray-400 uppercase">Personas</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={openAddPersona} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                            + Add Persona
                          </button>
                          <button
                            type="button"
                            onClick={generatePersonasOnly}
                            disabled={genLoading !== null || !genAgentId}
                            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {genLoading === "personas" ? "Generating..." : "Generate Personas"}
                          </button>
                          <button type="button" onClick={clearAllPersonas} className="text-xs px-3 py-1.5 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
                            Clear All
                          </button>
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            Count
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={personaGenCount}
                              onChange={(e) => setPersonaGenCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
                              className="w-14 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </label>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                        For AI generation, pick a connection and agent on the <strong>Analysis</strong> tab (or below). Manually added personas can omit the agent. Dimensions live on the <strong>Dimensions</strong> tab.
                      </p>
                      <div className="flex gap-2 mb-4 flex-wrap sm:hidden">
                        <select value={connId} onChange={(e) => setConnId(e.target.value)} className={SELECT_CLS}>
                          <option value="">Connection</option>
                          {connections.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <select value={genAgentId} onChange={(e) => setGenAgentId(e.target.value)} disabled={!connId} className={`${SELECT_CLS} disabled:opacity-50`}>
                          <option value="">Agent</option>
                          {connAgents.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      {personaFormOpen && (
                        <div className="mb-4 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col gap-2">
                          <div className="grid sm:grid-cols-2 gap-2">
                            <input placeholder="Name" value={personaForm.name} onChange={(e) => setPersonaForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                            <input placeholder="Persona" value={personaForm.description} onChange={(e) => setPersonaForm((f) => ({ ...f, description: e.target.value }))} className={INPUT_CLS} />
                            <input placeholder="Goal" value={personaForm.goal} onChange={(e) => setPersonaForm((f) => ({ ...f, goal: e.target.value }))} className={INPUT_CLS} />
                            <input placeholder="Personality" value={personaForm.personality} onChange={(e) => setPersonaForm((f) => ({ ...f, personality: e.target.value }))} className={INPUT_CLS} />
                            <input placeholder="Knowledge level" value={personaForm.knowledgeLevel} onChange={(e) => setPersonaForm((f) => ({ ...f, knowledgeLevel: e.target.value }))} className={`${INPUT_CLS} sm:col-span-2`} />
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={savePersona} disabled={savingPersona || !personaForm.name.trim()} className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                              {savingPersona ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setPersonaFormOpen(false); setEditingPersona(null); }}
                              className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {personas.length === 0 ? (
                        <p className="text-xs text-gray-400 py-6 text-center">No personas yet. Add one or generate with AI.</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {personas.map((p) => {
                            const qc = questionCountForPersona(p.name);
                            return (
                              <div key={p.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/30">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</span>
                                    {qc > 0 && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">
                                        {qc} q
                                      </span>
                                    )}
                                    {p.tag && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${p.tag === "internal" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"}`}>
                                        {p.tag}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <button type="button" onClick={() => openEditPersona(p)} className="text-[10px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-white dark:hover:bg-gray-800">
                                      Edit
                                    </button>
                                    <button type="button" onClick={() => removePersona(p)} className="text-[10px] px-2 py-1 text-red-600 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/20">
                                      Delete
                                    </button>
                                  </div>
                                </div>
                                {p.description ? (
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1"><span className="font-medium text-gray-600 dark:text-gray-300">Persona:</span> {p.description}</p>
                                ) : null}
                                {p.goal ? (
                                  <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1"><span className="font-medium">Goal:</span> {p.goal}</p>
                                ) : null}
                                {p.personality ? (
                                  <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1"><span className="font-medium">Personality:</span> {p.personality}</p>
                                ) : null}
                                {p.knowledge_level ? (
                                  <p className="text-[11px] text-gray-600 dark:text-gray-300"><span className="font-medium">Knowledge:</span> {p.knowledge_level}</p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* ── Dimensions tab ── */}
                {mainTab === "dimensionsTab" && (
                  <div className="flex flex-col gap-6">
                    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <h3 className="text-xs font-bold tracking-wide text-gray-500 dark:text-gray-400 uppercase">Dimensions</h3>
                        <button type="button" onClick={() => generate("dimensions")} disabled={genLoading !== null} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0">
                          {genLoading === "dimensions" ? "Generating..." : "Generate Dimensions"}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
                        Question dimensions and their values (used when generating questions). You can also run <strong>Gen dimensions</strong> from the <strong>Analysis</strong> tab.
                      </p>
                      {dimensions.length === 0 ? (
                        <p className="text-xs text-gray-400">No dimensions yet. Generate above or from Analysis.</p>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {dimensions.map((d) => (
                            <div key={d.id}>
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{d.name}</h5>
                              <div className="flex flex-wrap gap-1.5">
                                {d.values.map((v) => (
                                  <span key={v.id} title={v.description ?? undefined} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
                                    {v.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* ── Profiles tab (personality profiles for question phrasing) ── */}
                {mainTab === "profilesTab" && (
                  <div className="flex flex-col gap-6">
                    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <h3 className="text-xs font-bold tracking-wide text-gray-500 dark:text-gray-400 uppercase">Personality profiles</h3>
                        <button
                          type="button"
                          onClick={() => generate("profiles")}
                          disabled={genLoading !== null}
                          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                        >
                          {genLoading === "profiles" ? "Generating..." : "Generate Profiles"}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
                        Styles that shape how generated questions are phrased (e.g. direct, anxious, detail-oriented). Used together with personas and dimensions. You can also run <strong>Gen profiles</strong> from the <strong>Analysis</strong> tab.
                      </p>
                      {profiles.length === 0 ? (
                        <p className="text-xs text-gray-400">No profiles yet. Generate above or from Analysis.</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {profiles.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-xl border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 px-3 py-3"
                            >
                              <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">{p.name}</p>
                              {p.description ? (
                                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">{p.description}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* ── Questions tab ── */}
                {mainTab === "questions" && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                      Questions use your project&apos;s <strong>personas</strong>, <strong>dimensions</strong>, and <strong>profiles</strong> only. Connection and agent are chosen on the <strong>Runs</strong> page when you execute a test.
                    </p>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Questions</h3>
                      <button
                        type="button"
                        onClick={() => generate("questions")}
                        disabled={genLoading !== null}
                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {genLoading === "questions" ? "Generating..." : "Generate Questions"}
                      </button>
                    </div>
                    {questions.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        No questions yet. Add personas, dimensions, and profiles, then click <strong>Generate Questions</strong>.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {questions.map((q) => {
                          const isEditing = editingExpected === q.id;
                          return (
                            <div key={q.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                              <p className="text-sm text-gray-900 dark:text-white">{q.question}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {q.persona && <span className="text-xs text-blue-600 dark:text-blue-400">@{q.persona}</span>}
                                {q.dimension_value && <span className="text-xs text-gray-400">{q.dimension} / {q.dimension_value}</span>}
                                {q.personality_profile && <span className="text-xs text-purple-600 dark:text-purple-400">{q.personality_profile}</span>}
                              </div>
                              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                {isEditing ? (
                                  <div className="flex flex-col gap-1.5">
                                    <textarea
                                      ref={expectedRef}
                                      rows={3}
                                      className="w-full text-xs px-2 py-1.5 border border-indigo-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                                      placeholder="Enter expected answer..."
                                      value={expectedDraft}
                                      onChange={(e) => setExpectedDraft(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                      <button type="button" onClick={() => saveExpectedAnswer(q)} disabled={savingExpected} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50">
                                        {savingExpected ? "Saving..." : "Save"}
                                      </button>
                                      <button type="button" onClick={() => setEditingExpected(null)} className="text-xs text-gray-500 px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : q.expected_answer ? (
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs text-gray-400 mb-0.5">Expected answer</p>
                                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{q.expected_answer}</p>
                                    </div>
                                    <button type="button" onClick={() => { setEditingExpected(q.id); setExpectedDraft(q.expected_answer ?? ""); }} className="text-xs text-indigo-600 dark:text-indigo-400 shrink-0 hover:underline">
                                      Edit
                                    </button>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => { setEditingExpected(q.id); setExpectedDraft(""); }} className="text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                                    + Add expected answer
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const raw = params.id;
  const projectId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : "";
  if (!projectId) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center text-sm text-gray-500 dark:text-gray-400 p-6 bg-gray-50 dark:bg-gray-950">
        Invalid project URL.
      </div>
    );
  }
  return <ProjectDetailView key={projectId} projectId={projectId} />;
}
