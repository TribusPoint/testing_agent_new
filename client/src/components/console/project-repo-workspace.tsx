"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ConsoleBackToOverview } from "@/components/console/console-back-to-overview";
import * as api from "@/lib/api";
import { ENTITY_TABS, type EntityTab } from "@/components/settings/entity-tabs";
import { ProjectContextGeneration, type GenerationSection } from "@/components/settings/project-context-generation";
import { InfoHint } from "@/components/ui/info-hint";

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

function IconProject({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
      />
    </svg>
  );
}

export default function ProjectRepoWorkspace() {
  const [entityTab, setEntityTab] = useState<EntityTab>("personas");
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [projectId, setProjectId] = useState("");
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

  const genSection: GenerationSection = entityTab === "questions" ? "questions" : entityTab;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="flex items-start gap-2 sm:gap-3 mb-3">
          <ConsoleBackToOverview className="mt-0.5 shrink-0" />
          <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
            <IconProject className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white m-0">Project repo</h2>
              <InfoHint label="Project repo">
                Pick a project, then use the LLM-backed flows below. Personas, dimensions, profiles, and questions for
                that project are all generated here.
              </InfoHint>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-3">
          <label htmlFor="console-project-repo-select" className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">
            Project
          </label>
          <select
            id="console-project-repo-select"
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
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
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
          <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
            />
          </svg>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Choose a project above</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Then use the tabs to generate and manage personas, dimensions, profiles, and questions.</p>
        </div>
      )}
    </div>
  );
}
