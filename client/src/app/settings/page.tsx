"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import type { LlmConfig } from "@/lib/api";
import { ProjectContextGeneration, type GenerationSection } from "@/components/settings/project-context-generation";
import QuestionsRepoPanel from "@/components/settings/questions-repo-panel";
import CuratedLibraryPlaceholder from "@/components/settings/curated-library-placeholder";

type SettingsTab = "llm" | "project-repo" | "foundry";
type EntityTab = "personas" | "dimensions" | "profiles" | "questions";

const SETTINGS_COLLAPSED_KEY = "ta-settings-nav-collapsed";

const ENTITY_TABS: { id: EntityTab; label: string; icon: string }[] = [
  { id: "personas", label: "Personas", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { id: "dimensions", label: "Dimensions", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  { id: "profiles", label: "Profiles", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "questions", label: "Questions", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
];

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(SETTINGS_COLLAPSED_KEY) === "1"; } catch { return false; }
}

function IconLlm({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 00-.659 1.59V21.5M5 14.5l2.47 2.47a2.25 2.25 0 01.659 1.59V21.5m0 0h8.691" />
    </svg>
  );
}
function IconProject({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
    </svg>
  );
}
function IconFoundry({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  );
}

const FLOW_SELECT_STYLE =
  "bg-blue-50 dark:bg-blue-500/15 text-blue-800 dark:text-blue-100 border-blue-400/80 dark:border-blue-400/60 shadow-sm dark:shadow-[0_0_12px_rgba(59,130,246,0.25)]";
const FLOW_ENTITY_STYLES: Record<EntityTab, string> = {
  personas:
    "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-50 border-indigo-400/80 dark:border-indigo-400/50 shadow-sm dark:shadow-[0_0_12px_rgba(99,102,241,0.2)]",
  dimensions:
    "bg-violet-50 dark:bg-violet-500/15 text-violet-900 dark:text-violet-50 border-violet-400/80 dark:border-violet-400/50 shadow-sm dark:shadow-[0_0_12px_rgba(139,92,246,0.2)]",
  profiles:
    "bg-purple-50 dark:bg-purple-500/15 text-purple-900 dark:text-purple-50 border-purple-400/80 dark:border-purple-400/50 shadow-sm dark:shadow-[0_0_12px_rgba(168,85,247,0.2)]",
  questions:
    "bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-900 dark:text-fuchsia-50 border-fuchsia-400/80 dark:border-fuchsia-400/50 shadow-sm dark:shadow-[0_0_12px_rgba(217,70,239,0.2)]",
};

function InteractiveFlowDiagram({
  projectId,
  entityTab,
  onSelectProject,
  onEntityTab,
}: {
  projectId: string;
  entityTab: EntityTab;
  onSelectProject: () => void;
  onEntityTab: (t: EntityTab) => void;
}) {
  const steps: { id: "select" | EntityTab; label: string; style: string }[] = [
    { id: "select", label: "Select Project", style: FLOW_SELECT_STYLE },
    ...ENTITY_TABS.map((et) => ({ id: et.id, label: et.label, style: FLOW_ENTITY_STYLES[et.id] })),
  ];

  return (
    <div className="flex items-center gap-1.5 py-3 px-1 overflow-x-auto" role="navigation" aria-label="Project pipeline">
      {steps.map((step, i, arr) => {
        const isSelect = step.id === "select";
        const isActive = isSelect ? !projectId : Boolean(projectId) && entityTab === step.id;
        return (
          <div key={step.id} className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              title={isSelect ? "Focus project selector" : `Open ${step.label}`}
              onClick={() => {
                if (isSelect) onSelectProject();
                else onEntityTab(step.id as EntityTab);
              }}
              className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? `${step.style} ring-2 ring-indigo-400/90 dark:ring-indigo-400/80 scale-[1.02]`
                  : `${step.style} opacity-80 hover:opacity-100 hover:scale-[1.02]`
              }`}
            >
              {step.label}
            </button>
            {i < arr.length - 1 && (
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FoundryHero() {
  return (
    <div className="rounded-xl border border-dashed border-amber-300/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-yellow-50/80 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/30 p-5 mb-5 flex items-start gap-4">
      <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 dark:from-amber-600 dark:to-orange-700 flex items-center justify-center shadow-md">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
        </svg>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">The Foundry</h3>
        <p className="text-xs text-amber-800/80 dark:text-amber-300/70 leading-relaxed max-w-lg">
          Your curated library of reusable test assets. Browse, create, and manage pre-built personas, dimensions, profiles, and questions that can be applied across any project.
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("llm");
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [entityTab, setEntityTab] = useState<EntityTab>("personas");
  const [foundryEntity, setFoundryEntity] = useState<EntityTab>("questions");
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmError, setLlmError] = useState("");

  const projectSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => {});
  }, []);


  function focusProjectSelect() {
    projectSelectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => projectSelectRef.current?.focus(), 200);
  }

  function goToEntityTab(next: EntityTab) {
    if (!projectId) {
      focusProjectSelect();
      return;
    }
    setEntityTab(next);
  }

  useEffect(() => {
    if (api.getStoredKey() || api.getStoredToken()) {
      api.getLlmConfig().then(setLlmConfig).catch((e) => {
        setLlmError(e instanceof Error ? e.message : "Failed to load LLM config");
      });
    }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(SETTINGS_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* */ }
  }, [collapsed]);

  async function onProviderChange(next: "openai" | "anthropic") {
    setLlmError("");
    setLlmSaving(true);
    try {
      const cfg = await api.updateLlmProvider(next);
      setLlmConfig(cfg);
    } catch (e: unknown) {
      setLlmError(e instanceof Error ? e.message : "Failed to update provider");
    } finally {
      setLlmSaving(false);
    }
  }

  const genSection: GenerationSection = entityTab === "questions" ? "questions" : entityTab;

  const NAV_ITEMS: { id: SettingsTab; label: string; Icon: (p: { className?: string }) => React.JSX.Element }[] = [
    { id: "llm", label: "LLM Configuration", Icon: IconLlm },
    { id: "project-repo", label: "Project Repo", Icon: IconProject },
    { id: "foundry", label: "The Foundry", Icon: IconFoundry },
  ];

  return (
    <div className="flex flex-1 min-h-0 h-full min-w-0">
      {/* Collapsible left nav */}
      <nav
        className={`shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-0 overflow-hidden transition-[width] duration-200 ease-out ${
          collapsed ? "w-14" : "w-52"
        }`}
      >
        <div className={`flex items-center shrink-0 border-b border-gray-200 dark:border-gray-800 ${collapsed ? "justify-center py-2" : "justify-between px-3 py-2"}`}>
          {!collapsed && <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Settings</span>}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={collapsed ? "Expand settings nav" : "Collapse settings nav"}
          >
            {collapsed ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            )}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={collapsed ? item.label : undefined}
              onClick={() => setTab(item.id)}
              className={`flex items-center rounded-lg font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5 text-left"
              } ${
                tab === item.id
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <item.Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="text-sm truncate">{item.label}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">

          {/* ── LLM Configuration ── */}
          {tab === "llm" && (
            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <IconLlm className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">LLM Configuration</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Choose the active provider. Keys are configured server-side (environment variables or <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">.env</code>).
                  </p>
                </div>
              </div>
              {llmError && <p className="text-xs text-red-500 mb-2">{llmError}</p>}

              {llmConfig ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Provider</label>
                    <select
                      value={llmConfig.provider === "anthropic" ? "anthropic" : "openai"}
                      onChange={(e) => onProviderChange(e.target.value as "openai" | "anthropic")}
                      disabled={llmSaving}
                      className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                    {llmSaving && <span className="text-xs text-gray-400">Saving…</span>}
                  </div>

                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">API key status</h3>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: "OpenAI", active: llmConfig.openai_key_set },
                      { label: "Anthropic", active: llmConfig.anthropic_key_set },
                    ].map(({ label, active }) => (
                      <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${active ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-red-500"}`} />
                          {active ? "Active" : "Not set"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Active models</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Generation model", value: llmConfig.generation_model },
                      { label: "Evaluation model", value: llmConfig.evaluation_model },
                      { label: "Utterance model", value: llmConfig.utterance_model },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                        <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">{(api.getStoredKey() || api.getStoredToken()) ? "Loading…" : "Sign in to view LLM config."}</p>
              )}
            </section>
          )}

          {/* ── Project Repo ── */}
          {tab === "project-repo" && (
            <>
              {/* Header with flow diagram */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <IconProject className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Project Repo</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Pick a project, then generate personas, dimensions, profiles, and questions. Switching to{" "}
                      <strong className="text-gray-600 dark:text-gray-300">The Foundry</strong> does not remove data.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-3">
                  <label htmlFor="settings-project-repo-select" className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">
                    Project
                  </label>
                  <select
                    id="settings-project-repo-select"
                    ref={projectSelectRef}
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="flex-1 min-w-[12rem] max-w-md text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {projectId ? (
                    <Link
                      href={`/projects/${projectId}`}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 px-1"
                    >
                      Open project page →
                    </Link>
                  ) : null}
                </div>

                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">Click a step to jump — pipeline matches the tabs below.</p>
                <InteractiveFlowDiagram
                  projectId={projectId}
                  entityTab={entityTab}
                  onSelectProject={focusProjectSelect}
                  onEntityTab={goToEntityTab}
                />
              </div>

              {projectId ? (
                <>
                  {/* Horizontal entity tabs — synced with flow diagram */}
                  <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
                    {ENTITY_TABS.map((et) => (
                      <button
                        key={et.id}
                        type="button"
                        onClick={() => setEntityTab(et.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors -mb-px shrink-0 ${
                          entityTab === et.id
                            ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border border-b-0 border-gray-200 dark:border-gray-700"
                            : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={et.icon} />
                        </svg>
                        {et.label}
                      </button>
                    ))}
                  </div>

                  <ProjectContextGeneration projectId={projectId} section={genSection} />
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 p-10 text-center">
                  <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                  </svg>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Choose a project above</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Then use the tabs to generate and manage personas, dimensions, profiles, and questions.</p>
                </div>
              )}
            </>
          )}

          {/* ── The Foundry ── */}
          {tab === "foundry" && (
            <>
              <FoundryHero />
              <div className="flex min-h-0 gap-4">
                {/* Vertical entity sub-tabs */}
                <div className="w-44 shrink-0 flex flex-col gap-1">
                  {ENTITY_TABS.map((et) => (
                    <button
                      key={et.id}
                      type="button"
                      onClick={() => setFoundryEntity(et.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                        foundryEntity === et.id
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={et.icon} />
                      </svg>
                      <span className="truncate">{et.label}</span>
                    </button>
                  ))}
                </div>

                {/* Foundry content */}
                <div className="flex-1 min-w-0">
                  {foundryEntity === "questions" && <QuestionsRepoPanel />}
                  {foundryEntity === "personas" && <CuratedLibraryPlaceholder label="personas" />}
                  {foundryEntity === "dimensions" && <CuratedLibraryPlaceholder label="dimensions" />}
                  {foundryEntity === "profiles" && <CuratedLibraryPlaceholder label="profiles" />}
                </div>
              </div>
            </>
          )}

          <p className="text-xs text-gray-400">
            User accounts and API key management are under <strong className="text-gray-500">Admin access</strong> in the profile menu (bottom left).
          </p>
        </div>
      </div>
    </div>
  );
}
