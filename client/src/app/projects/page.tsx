"use client";
import { useState, useEffect, useRef } from "react";
import * as api from "@/lib/api";

type Tab = "personas" | "dimensions" | "profiles" | "questions";

const INPUT_CLS =
  "w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500";

const SELECT_CLS =
  "text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [selected, setSelected] = useState<api.Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", company_name: "", industry: "",
    competitors: "", company_websites: "", description: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({ name: "", description: "", company_name: "", industry: "", competitors: "", company_websites: "" });
  const [savingProject, setSavingProject] = useState(false);

  const [connections, setConnections] = useState<api.Connection[]>([]);
  const [connId, setConnId] = useState("");
  const [connAgents, setConnAgents] = useState<api.Agent[]>([]);
  const [genAgentId, setGenAgentId] = useState("");

  const [personas, setPersonas] = useState<api.Persona[]>([]);
  const [dimensions, setDimensions] = useState<api.Dimension[]>([]);
  const [profiles, setProfiles] = useState<api.PersonalityProfile[]>([]);
  const [questions, setQuestions] = useState<api.Question[]>([]);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("personas");
  const [editingExpected, setEditingExpected] = useState<string | null>(null);
  const [expectedDraft, setExpectedDraft] = useState("");
  const [savingExpected, setSavingExpected] = useState(false);
  const expectedRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadProjects();
    api.listConnections().then(setConnections).catch(() => {});
  }, []);

  useEffect(() => {
    if (connId) {
      api.listAgents(connId).then(setConnAgents).catch(() => setConnAgents([]));
      setGenAgentId("");
    }
  }, [connId]);

  useEffect(() => {
    if (selected) loadContextData(selected.id);
  }, [selected]);

  async function loadProjects() {
    try { setProjects(await api.listProjects()); } catch {}
  }

  async function handleDeleteProject() {
    if (!selected) return;
    if (!confirm(`Delete project "${selected.name}" and all its data?`)) return;
    setDeletingProject(true);
    try {
      await api.deleteProject(selected.id);
      setProjects((prev) => prev.filter((p) => p.id !== selected.id));
      setSelected(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally { setDeletingProject(false); }
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
      setProjects((prev) => prev.map((p) => p.id === selected.id ? updated : p));
      setSelected(updated);
      setShowEditProject(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally { setSavingProject(false); }
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

  async function handleSave() {
    if (!form.name.trim()) { alert("Project name is required."); return; }
    setSaving(true);
    try {
      await api.createProject(form);
      setForm({ name: "", company_name: "", industry: "", competitors: "", company_websites: "", description: "" });
      setShowForm(false);
      await loadProjects();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally { setSaving(false); }
  }

  async function generate(type: string) {
    if (!selected) return;
    if ((type === "personas" || type === "questions") && !genAgentId) {
      alert("Select an agent first.");
      return;
    }
    setGenLoading(type);
    try {
      if (type === "personas") await api.generatePersonas(selected.id, genAgentId);
      else if (type === "dimensions") await api.generateDimensions(selected.id);
      else if (type === "profiles") await api.generateProfiles(selected.id);
      else if (type === "questions") await api.generateQuestions(selected.id, genAgentId);
      await loadContextData(selected.id);
      setTab(type as Tab);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally { setGenLoading(null); }
  }

  const TABS: Tab[] = ["personas", "dimensions", "profiles", "questions"];
  const tabCount = { personas: personas.length, dimensions: dimensions.length, profiles: profiles.length, questions: questions.length };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Projects</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
          >
            + New
          </button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-2">
            {[
              { k: "name", label: "Project Name *" },
              { k: "company_name", label: "Company Name" },
              { k: "industry", label: "Industry" },
              { k: "company_websites", label: "Websites" },
              { k: "competitors", label: "Competitors" },
            ].map(({ k, label }) => (
              <input
                key={k}
                placeholder={label}
                value={form[k as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className={INPUT_CLS}
              />
            ))}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 text-xs bg-indigo-600 text-white py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 text-xs text-gray-600 dark:text-gray-400 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selected?.id === p.id
                  ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              <div className="text-sm font-medium truncate">{p.name}</div>
              {p.company_name && (
                <div className="text-xs text-gray-400 truncate">{p.company_name}</div>
              )}
            </button>
          ))}
          {projects.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">No projects yet</p>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 flex flex-col gap-5">
            {/* Project info */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">{selected.name}</h3>
                <div className="flex gap-2">
                  <button onClick={openEditProject} className="text-xs px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                    Edit
                  </button>
                  <button onClick={handleDeleteProject} disabled={deletingProject} className="text-xs px-3 py-1 text-red-500 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40">
                    {deletingProject ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
              {showEditProject && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col gap-2">
                  <input placeholder="Project name *" value={editProjectForm.name} onChange={(e) => setEditProjectForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                  <input placeholder="Company name" value={editProjectForm.company_name} onChange={(e) => setEditProjectForm((f) => ({ ...f, company_name: e.target.value }))} className={INPUT_CLS} />
                  <input placeholder="Industry" value={editProjectForm.industry} onChange={(e) => setEditProjectForm((f) => ({ ...f, industry: e.target.value }))} className={INPUT_CLS} />
                  <input placeholder="Websites" value={editProjectForm.company_websites} onChange={(e) => setEditProjectForm((f) => ({ ...f, company_websites: e.target.value }))} className={INPUT_CLS} />
                  <input placeholder="Competitors" value={editProjectForm.competitors} onChange={(e) => setEditProjectForm((f) => ({ ...f, competitors: e.target.value }))} className={INPUT_CLS} />
                  <textarea placeholder="Description" rows={2} value={editProjectForm.description} onChange={(e) => setEditProjectForm((f) => ({ ...f, description: e.target.value }))} className={INPUT_CLS + " resize-none"} />
                  <div className="flex gap-2">
                    <button onClick={handleSaveProject} disabled={savingProject || !editProjectForm.name.trim()} className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                      {savingProject ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setShowEditProject(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                {(
                  [
                    ["Company", selected.company_name],
                    ["Industry", selected.industry],
                    ["Websites", selected.company_websites],
                    ["Competitors", selected.competitors],
                  ] as [string, string | null][]
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-gray-400">{k}</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>

            {/* Generate section */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Generate Context
              </h4>
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
              <div className="flex gap-2 flex-wrap">
                {TABS.map((type) => (
                  <button
                    key={type}
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
                  Generating {genLoading}... this may take 15-30 seconds.
                </p>
              )}
            </div>

            {/* Content tabs */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-800">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                      tab === t
                        ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    {tabCount[t] > 0 && (
                      <span className="ml-1 text-gray-400">({tabCount[t]})</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {tab === "personas" && (
                  personas.length === 0 ? (
                    <p className="text-xs text-gray-400">No personas yet. Click Gen personas above.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {personas.map((p) => (
                        <div
                          key={p.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {p.name}
                            </span>
                            {p.tag && (
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  p.tag === "internal"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                    : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                }`}
                              >
                                {p.tag}
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {p.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === "dimensions" && (
                  dimensions.length === 0 ? (
                    <p className="text-xs text-gray-400">No dimensions yet. Click Gen dimensions above.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {dimensions.map((d) => (
                        <div key={d.id}>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            {d.name}
                          </h5>
                          <div className="flex flex-wrap gap-1.5">
                            {d.values.map((v) => (
                              <span
                                key={v.id}
                                title={v.description ?? undefined}
                                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full cursor-default"
                              >
                                {v.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === "profiles" && (
                  profiles.length === 0 ? (
                    <p className="text-xs text-gray-400">No profiles yet. Click Gen profiles above.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {profiles.map((p) => (
                        <div
                          key={p.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                        >
                          <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                            {p.name}
                          </div>
                          {p.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {p.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === "questions" && (
                  questions.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      No questions yet. Generate personas, dimensions, and profiles first, then click Gen questions.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {questions.map((q) => {
                        const isEditing = editingExpected === q.id;
                        return (
                          <div
                            key={q.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                          >
                            <p className="text-sm text-gray-900 dark:text-white">{q.question}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {q.persona && (
                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                  @{q.persona}
                                </span>
                              )}
                              {q.dimension_value && (
                                <span className="text-xs text-gray-400">
                                  {q.dimension} / {q.dimension_value}
                                </span>
                              )}
                              {q.personality_profile && (
                                <span className="text-xs text-purple-600 dark:text-purple-400">
                                  {q.personality_profile}
                                </span>
                              )}
                            </div>

                            {/* Expected answer */}
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
                                    <button
                                      onClick={() => saveExpectedAnswer(q)}
                                      disabled={savingExpected}
                                      className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                      {savingExpected ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      onClick={() => setEditingExpected(null)}
                                      className="text-xs text-gray-500 px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : q.expected_answer ? (
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Expected answer</p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                                      {q.expected_answer}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => { setEditingExpected(q.id); setExpectedDraft(q.expected_answer ?? ""); }}
                                    className="text-xs text-indigo-600 dark:text-indigo-400 shrink-0 hover:underline"
                                  >
                                    Edit
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingExpected(q.id); setExpectedDraft(""); }}
                                  className="text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                  + Add expected answer
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            Select a project or create a new one
          </div>
        )}
      </div>
    </div>
  );
}
