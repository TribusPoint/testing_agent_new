"use client";

import { useState, useEffect, useCallback } from "react";
import * as api from "@/lib/api";
import type { RepoQuestion, DomainCategoryInfo } from "@/lib/api";

const INPUT_CLS =
  "w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
const SELECT_CLS =
  "text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500";

export default function QuestionsRepoPage() {
  const [questions, setQuestions] = useState<RepoQuestion[]>([]);
  const [domains, setDomains] = useState<DomainCategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterDomain, setFilterDomain] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchText, setSearchText] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ question: "", expected_answer: "", domain: "general", category: "uncategorized", tags: "" });
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ question: "", expected_answer: "", domain: "", category: "", tags: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [qs, doms] = await Promise.allSettled([
        api.listRepoQuestions({
          domain: filterDomain || undefined,
          category: filterCategory || undefined,
          search: searchText || undefined,
        }),
        api.listRepoDomains(),
      ]);
      if (qs.status === "fulfilled") setQuestions(qs.value);
      if (doms.status === "fulfilled") setDomains(doms.value);
    } finally {
      setLoading(false);
    }
  }, [filterDomain, filterCategory, searchText]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeDomain = domains.find((d) => d.domain === filterDomain);
  const categoryOptions = activeDomain?.categories ?? [];

  async function handleAdd() {
    if (!addForm.question.trim()) return;
    setSaving(true);
    try {
      await api.createRepoQuestion({
        question: addForm.question.trim(),
        expected_answer: addForm.expected_answer.trim() || undefined,
        domain: addForm.domain.trim() || "general",
        category: addForm.category.trim() || "uncategorized",
        tags: addForm.tags ? addForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      setAddForm({ question: "", expected_answer: "", domain: "general", category: "uncategorized", tags: "" });
      setShowAdd(false);
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(q: RepoQuestion) {
    setEditingId(q.id);
    setEditForm({
      question: q.question,
      expected_answer: q.expected_answer ?? "",
      domain: q.domain,
      category: q.category,
      tags: q.tags.join(", "),
    });
  }

  async function handleSaveEdit() {
    if (!editingId || !editForm.question.trim()) return;
    setSaving(true);
    try {
      await api.updateRepoQuestion(editingId, {
        question: editForm.question.trim(),
        expected_answer: editForm.expected_answer.trim() || undefined,
        domain: editForm.domain.trim() || "general",
        category: editForm.category.trim() || "uncategorized",
        tags: editForm.tags ? editForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      setEditingId(null);
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question from the repo?")) return;
    try {
      await api.deleteRepoQuestion(id);
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-3">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Questions Repository</h1>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
        >
          {showAdd ? "Close" : "+ Add Question"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
            <div className="flex flex-col gap-1 min-w-[8rem]">
              <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Domain</label>
              <select
                value={filterDomain}
                onChange={(e) => { setFilterDomain(e.target.value); setFilterCategory(""); }}
                className={SELECT_CLS}
              >
                <option value="">All domains</option>
                {domains.map((d) => (
                  <option key={d.domain} value={d.domain}>{d.domain} ({d.count})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[8rem]">
              <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                disabled={!filterDomain}
                className={`${SELECT_CLS} disabled:opacity-50`}
              >
                <option value="">All categories</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[12rem]">
              <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Search</label>
              <input
                type="text"
                placeholder="Search questions..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={() => { setFilterDomain(""); setFilterCategory(""); setSearchText(""); }}
              className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 px-2 py-1.5"
            >
              Clear
            </button>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add Question to Repository</h3>
              <div className="flex flex-col gap-2 max-w-2xl">
                <textarea
                  rows={2}
                  placeholder="Question text *"
                  value={addForm.question}
                  onChange={(e) => setAddForm((f) => ({ ...f, question: e.target.value }))}
                  className={INPUT_CLS + " resize-none"}
                />
                <textarea
                  rows={2}
                  placeholder="Expected answer (optional)"
                  value={addForm.expected_answer}
                  onChange={(e) => setAddForm((f) => ({ ...f, expected_answer: e.target.value }))}
                  className={INPUT_CLS + " resize-none"}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    placeholder="Domain (e.g. banking)"
                    value={addForm.domain}
                    onChange={(e) => setAddForm((f) => ({ ...f, domain: e.target.value }))}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Category (e.g. FAQ)"
                    value={addForm.category}
                    onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Tags (comma separated)"
                    value={addForm.tags}
                    onChange={(e) => setAddForm((f) => ({ ...f, tags: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={saving || !addForm.question.trim()}
                    className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Add to Repository"}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-400">
              {loading ? "Loading..." : `${questions.length} question${questions.length !== 1 ? "s" : ""}`}
              {filterDomain ? ` in ${filterDomain}` : ""}
              {filterCategory ? ` / ${filterCategory}` : ""}
            </p>
          </div>

          {/* Questions list */}
          {!loading && questions.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">
              No questions in the repository yet. Add questions manually or promote them from a project.
            </div>
          )}

          <div className="flex flex-col gap-2">
            {questions.map((q) => {
              const isEditing = editingId === q.id;

              if (isEditing) {
                return (
                  <div key={q.id} className="border border-indigo-200 dark:border-indigo-900 rounded-lg p-3 bg-indigo-50/30 dark:bg-indigo-950/20">
                    <div className="flex flex-col gap-2">
                      <textarea
                        rows={2}
                        value={editForm.question}
                        onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                        className={INPUT_CLS + " resize-none text-sm"}
                      />
                      <textarea
                        rows={2}
                        placeholder="Expected answer"
                        value={editForm.expected_answer}
                        onChange={(e) => setEditForm((f) => ({ ...f, expected_answer: e.target.value }))}
                        className={INPUT_CLS + " resize-none text-sm"}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input value={editForm.domain} onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))} className={INPUT_CLS} placeholder="Domain" />
                        <input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} className={INPUT_CLS} placeholder="Category" />
                        <input value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} className={INPUT_CLS} placeholder="Tags" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={handleSaveEdit} disabled={saving} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={q.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">{q.question}</p>
                      {q.expected_answer && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span className="font-medium">Expected:</span> {q.expected_answer}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                          {q.domain}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {q.category}
                        </span>
                        {q.tags.map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                            {t}
                          </span>
                        ))}
                        {q.persona && <span className="text-[10px] text-blue-500 dark:text-blue-400">@{q.persona}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => startEdit(q)} className="text-[10px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(q.id)} className="text-[10px] px-2 py-1 text-red-600 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/20">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
