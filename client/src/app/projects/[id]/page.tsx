"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import * as api from "@/lib/api";
import { InfoHint } from "@/components/ui/info-hint";
import { INPUT_CLS } from "../ui-constants";

function ProjectDetailView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const repoHome = user?.role === "admin" ? "/console/project-repo" : "/dashboard";
  const [selected, setSelected] = useState<api.Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({
    name: "",
    description: "",
    company_name: "",
    industry: "",
    competitors: "",
    company_websites: "",
  });
  const [savingProject, setSavingProject] = useState(false);

  const [personaCount, setPersonaCount] = useState(0);
  const [dimensionCount, setDimensionCount] = useState(0);
  const [profileCount, setProfileCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);

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
    if (!selected) return;
    void (async () => {
      const [p, d, pr, q] = await Promise.allSettled([
        api.listPersonas(selected.id),
        api.listDimensions(selected.id),
        api.listProfiles(selected.id),
        api.listQuestions(selected.id),
      ]);
      if (p.status === "fulfilled") setPersonaCount(p.value.length);
      if (d.status === "fulfilled") setDimensionCount(d.value.length);
      if (pr.status === "fulfilled") setProfileCount(pr.value.length);
      if (q.status === "fulfilled") setQuestionCount(q.value.length);
    })();
  }, [selected]);

  async function handleDeleteProject() {
    if (!selected) return;
    if (!confirm(`Delete project "${selected.name}" and all its data?`)) return;
    setDeletingProject(true);
    try {
      await api.deleteProject(selected.id);
      router.replace(user?.role === "admin" ? "/console/project-repo" : "/dashboard");
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
    } finally {
      setSavingProject(false);
    }
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
        <Link href={repoHome} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
          {user?.role === "admin" ? "Back to project repo" : "Back to dashboard"}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={repoHome}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 font-medium"
          >
            {user?.role === "admin" ? "← Project repo" : "← Dashboard"}
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
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white m-0">Edit project parameters</h2>
                  <InfoHint label="Edit project parameters">
                    Name, company, industry, websites, and competitors are used for generation.
                  </InfoHint>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditProject(false)}
                  className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-col gap-2 max-w-xl">
                <input
                  placeholder="Project name *"
                  value={editProjectForm.name}
                  onChange={(e) => setEditProjectForm((f) => ({ ...f, name: e.target.value }))}
                  className={INPUT_CLS}
                />
                <input
                  placeholder="Company name"
                  value={editProjectForm.company_name}
                  onChange={(e) => setEditProjectForm((f) => ({ ...f, company_name: e.target.value }))}
                  className={INPUT_CLS}
                />
                <input
                  placeholder="Industry"
                  value={editProjectForm.industry}
                  onChange={(e) => setEditProjectForm((f) => ({ ...f, industry: e.target.value }))}
                  className={INPUT_CLS}
                />
                <input
                  placeholder="Websites (URLs, comma or space separated)"
                  value={editProjectForm.company_websites}
                  onChange={(e) => setEditProjectForm((f) => ({ ...f, company_websites: e.target.value }))}
                  className={INPUT_CLS}
                />
                <input
                  placeholder="Competitors"
                  value={editProjectForm.competitors}
                  onChange={(e) => setEditProjectForm((f) => ({ ...f, competitors: e.target.value }))}
                  className={INPUT_CLS}
                />
                <textarea
                  placeholder="Description"
                  rows={3}
                  value={editProjectForm.description}
                  onChange={(e) => setEditProjectForm((f) => ({ ...f, description: e.target.value }))}
                  className={INPUT_CLS + " resize-none"}
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveProject}
                    disabled={savingProject || !editProjectForm.name.trim()}
                    className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingProject ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditProject(false)}
                    className="text-xs text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "PERSONAS", value: personaCount },
              { label: "DIMENSIONS", value: dimensionCount },
              { label: "PROFILES", value: profileCount },
              { label: "QUESTIONS", value: questionCount },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold tracking-wide text-gray-400 dark:text-gray-500">{card.label}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Project details */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white m-0">Project details</h3>
              <InfoHint label="Project details">
                Manage personas, dimensions, profiles, and questions from the{" "}
                <strong className="text-gray-600 dark:text-gray-300">Console → Project repo</strong> (admins).
                To change the project name,
                websites, or company fields, use <strong>Edit project</strong> in the top bar.
              </InfoHint>
            </div>
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
