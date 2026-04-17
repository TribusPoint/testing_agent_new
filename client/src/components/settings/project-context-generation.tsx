"use client";

import { useState, useEffect, useRef } from "react";
import * as api from "@/lib/api";
import { InfoHint } from "@/components/ui/info-hint";
import { INPUT_CLS, type GenStep } from "@/app/projects/ui-constants";

export type GenerationSection = "personas" | "dimensions" | "profiles" | "questions";

type Props = {
  projectId: string;
  section: GenerationSection;
};

export function ProjectContextGeneration({ projectId, section }: Props) {
  const [personas, setPersonas] = useState<api.Persona[]>([]);
  const [dimensions, setDimensions] = useState<api.Dimension[]>([]);
  const [profiles, setProfiles] = useState<api.PersonalityProfile[]>([]);
  const [questions, setQuestions] = useState<api.Question[]>([]);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [genAllStep, setGenAllStep] = useState<string | null>(null);
  const [personaGenCount, setPersonaGenCount] = useState(4);
  const [questionsPerPersona, setQuestionsPerPersona] = useState(3);
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

  const [selectedQIds, setSelectedQIds] = useState<Set<string>>(new Set());
  const [showPromote, setShowPromote] = useState(false);
  const [promoteForm, setPromoteForm] = useState({ domain: "general", category: "uncategorized", tags: "" });
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    void loadContextData(projectId);
  }, [projectId]);

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
    setGenLoading(type);
    try {
      if (type === "personas") await api.generatePersonas(projectId, "", personaGenCount);
      else if (type === "dimensions") await api.generateDimensions(projectId);
      else if (type === "profiles") await api.generateProfiles(projectId);
      else if (type === "questions") await api.generateQuestions(projectId, questionsPerPersona);
      await loadContextData(projectId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenLoading(null);
    }
  }

  async function generateAll() {
    const steps: GenStep[] = ["personas", "dimensions", "profiles", "questions"];
    setGenLoading("all");
    try {
      for (const step of steps) {
        setGenAllStep(step);
        if (step === "personas") await api.generatePersonas(projectId, "", personaGenCount);
        else if (step === "dimensions") await api.generateDimensions(projectId);
        else if (step === "profiles") await api.generateProfiles(projectId);
        else if (step === "questions") await api.generateQuestions(projectId, questionsPerPersona);
        await loadContextData(projectId);
      }
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
    if (!personaForm.name.trim()) return;
    setSavingPersona(true);
    try {
      if (editingPersona) {
        await api.updatePersona(projectId, editingPersona.id, {
          name: personaForm.name.trim(),
          description: personaForm.description.trim() || null,
          goal: personaForm.goal.trim() || null,
          personality: personaForm.personality.trim() || null,
          knowledge_level: personaForm.knowledgeLevel.trim() || null,
        });
      } else {
        await api.createPersona(projectId, {
          name: personaForm.name.trim(),
          description: personaForm.description.trim() || null,
          goal: personaForm.goal.trim() || null,
          personality: personaForm.personality.trim() || null,
          knowledge_level: personaForm.knowledgeLevel.trim() || null,
          agent_id: null,
        });
      }
      setPersonaFormOpen(false);
      setEditingPersona(null);
      await loadContextData(projectId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingPersona(false);
    }
  }

  async function removePersona(p: api.Persona) {
    if (!confirm(`Delete persona "${p.name}"?`)) return;
    try {
      await api.deletePersona(projectId, p.id);
      await loadContextData(projectId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function clearAllPersonas() {
    if (!confirm("Remove all personas for this project?")) return;
    try {
      await api.deleteAllPersonas(projectId);
      await loadContextData(projectId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Clear failed");
    }
  }

  async function generatePersonasOnly() {
    setGenLoading("personas");
    try {
      await api.generatePersonas(projectId, "", personaGenCount);
      await loadContextData(projectId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenLoading(null);
    }
  }

  function questionCountForPersona(name: string) {
    return questions.filter((q) => q.persona === name).length;
  }

  async function saveExpectedAnswer(q: api.Question) {
    setSavingExpected(true);
    try {
      const updated = await api.updateQuestion(projectId, q.id, { expected_answer: expectedDraft.trim() || null });
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? updated : x)));
      setEditingExpected(null);
    } catch {
      /* ignore */
    } finally {
      setSavingExpected(false);
    }
  }

  function toggleQSelection(id: string) {
    setSelectedQIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllQuestions() {
    if (selectedQIds.size === questions.length) setSelectedQIds(new Set());
    else setSelectedQIds(new Set(questions.map((q) => q.id)));
  }

  async function handlePromote() {
    if (selectedQIds.size === 0) return;
    const count = selectedQIds.size;
    setPromoting(true);
    try {
      await api.promoteToRepo({
        question_ids: Array.from(selectedQIds),
        domain: promoteForm.domain.trim() || "general",
        category: promoteForm.category.trim() || "uncategorized",
        tags: promoteForm.tags ? promoteForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      setSelectedQIds(new Set());
      setShowPromote(false);
      alert(`${count} question(s) saved to repository.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to promote");
    } finally {
      setPromoting(false);
    }
  }

  const genAllBlock = (
    <div className="relative mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-4 pr-10">
      <div className="absolute right-3 top-3">
        <InfoHint label="Generation pipeline">
          Use Gen All to run the full pipeline, or generate each step individually.
        </InfoHint>
      </div>
      <div className="flex gap-3 flex-wrap items-center mb-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          Personas
          <input
            type="number"
            min={1}
            max={12}
            value={personaGenCount}
            onChange={(e) => setPersonaGenCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            className="w-14 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          Questions / persona
          <input
            type="number"
            min={1}
            max={20}
            value={questionsPerPersona}
            onChange={(e) => setQuestionsPerPersona(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            className="w-14 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </label>
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
          {genLoading === "all" ? `Generating all (${genAllStep})...` : `Generating ${genLoading}...`}
        </p>
      )}
    </div>
  );

  if (section === "personas") {
    return (
      <div className="flex flex-col gap-4">
        {genAllBlock}
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
                disabled={genLoading !== null}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {genLoading === "personas" ? "Generating..." : "Generate Personas"}
              </button>
              <button type="button" onClick={clearAllPersonas} className="text-xs px-3 py-1.5 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
                Clear All
              </button>
            </div>
          </div>
          {personaFormOpen && (
            <div className="mb-4 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col gap-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input placeholder="Name" value={personaForm.name} onChange={(e) => setPersonaForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                <input placeholder="Persona" value={personaForm.description} onChange={(e) => setPersonaForm((f) => ({ ...f, description: e.target.value }))} className={INPUT_CLS} />
                <input placeholder="Goal" value={personaForm.goal} onChange={(e) => setPersonaForm((f) => ({ ...f, goal: e.target.value }))} className={INPUT_CLS} />
                <input placeholder="Personality" value={personaForm.personality} onChange={(e) => setPersonaForm((f) => ({ ...f, personality: e.target.value }))} className={INPUT_CLS} />
                <input
                  placeholder="Knowledge level"
                  value={personaForm.knowledgeLevel}
                  onChange={(e) => setPersonaForm((f) => ({ ...f, knowledgeLevel: e.target.value }))}
                  className={`${INPUT_CLS} sm:col-span-2`}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={savePersona} disabled={savingPersona || !personaForm.name.trim()} className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {savingPersona ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPersonaFormOpen(false);
                    setEditingPersona(null);
                  }}
                  className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {personas.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No personas yet.</p>
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
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">{qc} q</span>
                        )}
                        {p.tag && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                              p.tag === "internal" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            }`}
                          >
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
                    {p.description ? <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1"><span className="font-medium text-gray-600 dark:text-gray-300">Persona:</span> {p.description}</p> : null}
                    {p.goal ? <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1"><span className="font-medium">Goal:</span> {p.goal}</p> : null}
                    {p.personality ? <p className="text-[11px] text-gray-600 dark:text-gray-300 mb-1"><span className="font-medium">Personality:</span> {p.personality}</p> : null}
                    {p.knowledge_level ? <p className="text-[11px] text-gray-600 dark:text-gray-300"><span className="font-medium">Knowledge:</span> {p.knowledge_level}</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (section === "dimensions") {
    return (
      <div className="flex flex-col gap-4">
        {genAllBlock}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h3 className="text-xs font-bold tracking-wide text-gray-500 dark:text-gray-400 uppercase">Dimensions</h3>
            <button type="button" onClick={() => generate("dimensions")} disabled={genLoading !== null} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0">
              {genLoading === "dimensions" ? "Generating..." : "Generate Dimensions"}
            </button>
          </div>
          {dimensions.length === 0 ? (
            <p className="text-xs text-gray-400">No dimensions yet.</p>
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
    );
  }

  if (section === "profiles") {
    return (
      <div className="flex flex-col gap-4">
        {genAllBlock}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h3 className="text-xs font-bold tracking-wide text-gray-500 dark:text-gray-400 uppercase">Personality profiles</h3>
            <button type="button" onClick={() => generate("profiles")} disabled={genLoading !== null} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0">
              {genLoading === "profiles" ? "Generating..." : "Generate Profiles"}
            </button>
          </div>
          {profiles.length === 0 ? (
            <p className="text-xs text-gray-400">No profiles yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {profiles.map((p) => (
                <div key={p.id} className="rounded-xl border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 px-3 py-3">
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">{p.name}</p>
                  {p.description ? <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">{p.description}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // questions
  return (
    <div className="flex flex-col gap-4">
      {genAllBlock}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white m-0">Questions</h3>
            <InfoHint label="Questions">
              Questions use <strong>personas</strong>, <strong>dimensions</strong>, and <strong>profiles</strong> from this
              project. Pick connection and agent on the <strong>Runs</strong> page when executing.
            </InfoHint>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            {questions.length > 0 && (
              <>
                <button type="button" onClick={toggleAllQuestions} className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                  {selectedQIds.size === questions.length ? "Deselect All" : "Select All"}
                </button>
                {selectedQIds.size > 0 && (
                  <button type="button" onClick={() => setShowPromote(true)} className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                    Save to Repo ({selectedQIds.size})
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={() => generate("questions")} disabled={genLoading !== null} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {genLoading === "questions" ? "Generating..." : "Generate Questions"}
            </button>
          </div>
        </div>
        {showPromote && selectedQIds.size > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Save {selectedQIds.size} question(s) to the global repository</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input placeholder="Domain" value={promoteForm.domain} onChange={(e) => setPromoteForm((f) => ({ ...f, domain: e.target.value }))} className={INPUT_CLS} />
              <input placeholder="Category" value={promoteForm.category} onChange={(e) => setPromoteForm((f) => ({ ...f, category: e.target.value }))} className={INPUT_CLS} />
              <input placeholder="Tags" value={promoteForm.tags} onChange={(e) => setPromoteForm((f) => ({ ...f, tags: e.target.value }))} className={INPUT_CLS} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handlePromote} disabled={promoting} className="text-xs bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {promoting ? "Saving..." : "Save to Repository"}
              </button>
              <button type="button" onClick={() => setShowPromote(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                Cancel
              </button>
            </div>
          </div>
        )}
        {questions.length === 0 ? (
          <p className="text-xs text-gray-400">No questions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {questions.map((q) => {
              const isEditing = editingExpected === q.id;
              const isSelected = selectedQIds.has(q.id);
              return (
                <div key={q.id} className={`border rounded-lg p-3 ${isSelected ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-gray-200 dark:border-gray-700"}`}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleQSelection(q.id)} className="mt-1 shrink-0 accent-emerald-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">{q.question}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {q.persona && <span className="text-xs text-blue-600 dark:text-blue-400">@{q.persona}</span>}
                        {q.dimension_value && (
                          <span className="text-xs text-gray-400">
                            {q.dimension} / {q.dimension_value}
                          </span>
                        )}
                        {q.personality_profile && <span className="text-xs text-purple-600 dark:text-purple-400">{q.personality_profile}</span>}
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        {isEditing ? (
                          <div className="flex flex-col gap-1.5">
                            <textarea
                              ref={expectedRef}
                              rows={3}
                              className="w-full text-xs px-2 py-1.5 border border-indigo-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                              placeholder="Expected answer..."
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
                            <button
                              type="button"
                              onClick={() => {
                                setEditingExpected(q.id);
                                setExpectedDraft(q.expected_answer ?? "");
                              }}
                              className="text-xs text-indigo-600 dark:text-indigo-400 shrink-0 hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpected(q.id);
                              setExpectedDraft("");
                            }}
                            className="text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            + Add expected answer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
