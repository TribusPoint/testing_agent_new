"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import TstAgntTable, { type TstAgntColumnConfig } from "@/components/ui/tst-agnt-table";
import { usePersistedState } from "@/lib/usePersistedState";
import { INPUT_CLS } from "./ui-constants";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [showForm, setShowForm] = usePersistedState("projects:showForm", false);
  const [form, setForm] = usePersistedState("projects:form", {
    name: "", company_name: "", industry: "",
    competitors: "", company_websites: "", description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setProjects(await api.listProjects());
    } catch {
      /* ignore */
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("Project name is required.");
      return;
    }
    setSaving(true);
    try {
      await api.createProject(form);
      setForm({ name: "", company_name: "", industry: "", competitors: "", company_websites: "", description: "" });
      setShowForm(false);
      await loadProjects();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const sortedProjects = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const projTableRows = sortedProjects.map((p) => ({
    id: p.id,
    name: p.name,
    company: p.company_name ?? "",
    industry: p.industry ?? "",
    questions: 0,
    _proj: p,
  }));

  const projTableColumns: TstAgntColumnConfig<(typeof projTableRows)[number]>[] = [
    {
      key: "name",
      label: "Project",
      sortable: true,
      searchable: true,
      renderCell: (value) => (
        <span className="font-medium text-gray-900 dark:text-white">{String(value)}</span>
      ),
    },
    {
      key: "company",
      label: "Company",
      sortable: true,
      searchable: true,
      renderCell: (value) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">{String(value || "—")}</span>
      ),
    },
    {
      key: "industry",
      label: "Industry",
      sortable: true,
      renderCell: (value) =>
        value ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
            {String(value)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Projects</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 shrink-0"
        >
          {showForm ? "✕ Close" : "+ New"}
        </button>
      </div>

      {showForm && (
        <div className="shrink-0 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-2 max-w-3xl mx-auto w-full">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">New project</p>
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

      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white dark:bg-gray-900">
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 max-w-6xl mx-auto w-full">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
            Select a project to open its workspace (analysis, personas, dimensions, questions).
          </p>
          <TstAgntTable
            data={projTableRows}
            columns={projTableColumns}
            enableSearch={true}
            searchPlaceholder="Search projects..."
            pagination={{ enabled: true, rowsPerPage: 10 }}
            onRowClick={(row) => router.push(`/projects/${row._proj.id}`)}
            selectedRowId={null}
            emptyState={
              <p className="text-xs text-gray-400 py-4">
                No projects yet — use <strong>+ New</strong> above to create one.
              </p>
            }
          />
        </div>
      </div>
    </div>
  );
}
