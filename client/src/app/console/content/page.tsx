"use client";

import Link from "next/link";
import { useState } from "react";
import { ConsoleBackToOverview } from "@/components/console/console-back-to-overview";
import { InfoHint } from "@/components/ui/info-hint";
import { ENTITY_TABS, type EntityTab } from "@/components/settings/entity-tabs";

const ENTITY_INTRO: Record<EntityTab, string> = {
  personas:
    "Personas land here after a successful parse. Draft, review, and edit before anything is published to the Knowledge base for testers.",
  dimensions:
    "Dimensions follow the same path: upload → Foundry records → review → optional publish downstream.",
  profiles:
    "Profile bundles become Foundry assets first so you can validate structure, metadata, and future domain tags.",
  questions:
    "Question banks are staged here with the same lifecycle. Bundles that mix types will follow the same rules once supported.",
};

const ENTITY_BULLETS: Record<EntityTab, string[]> = {
  personas: [
    "Use the upload entry for Personas (or a labeled bundle) so the backend can map the file to this entity.",
    "After validation, records appear as drafts in Foundry for review and edits.",
    "Publish to Knowledge base only when you are ready for members to see them in the app.",
  ],
  dimensions: [
    "Upload rubrics or tables through the Dimensions entry point (or an approved bundle format).",
    "Foundry keeps the authoritative copy; Knowledge base exposes the subset you publish.",
    "Domain tagging and advanced QA are planned—layout stays stable as features arrive.",
  ],
  profiles: [
    "Profiles enter Foundry after parse; you can replace files and compare versions before publishing.",
    "Unpublish from Knowledge base hides content from testers without deleting the Foundry draft.",
  ],
  questions: [
    "Single-type files or future multi-type bundles both resolve to Foundry drafts first.",
    "Normalize tags and severities here; members only see published banks downstream.",
  ],
};

const ENTITY_STATUS: Record<EntityTab, "soon" | "later"> = {
  personas: "soon",
  dimensions: "soon",
  profiles: "soon",
  questions: "later",
};

function statusLabel(s: "soon" | "later") {
  return s === "later" ? "Later" : "Soon";
}

function FoundryFlowDiagram() {
  const step =
    "flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300";
  const arrow = "text-gray-300 dark:text-gray-600 select-none";
  return (
    <div
      className="flex flex-col items-stretch gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-center sm:gap-2 dark:border-gray-800 dark:bg-gray-900/40"
      aria-hidden
    >
      <div className={step}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-[10px] font-bold text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400">
          1
        </span>
        Uploads
      </div>
      <span className={`${arrow} hidden text-center sm:block`}>→</span>
      <span className={`${arrow} text-center sm:hidden`}>↓</span>
      <div className={step}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-[10px] font-bold text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400">
          2
        </span>
        Foundry
      </div>
      <span className={`${arrow} hidden text-center sm:block`}>→</span>
      <span className={`${arrow} text-center sm:hidden`}>↓</span>
      <div className={step}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-[10px] font-bold text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400">
          3
        </span>
        Knowledge base
      </div>
    </div>
  );
}

function FoundryUploadEntryPoints({ entity, setEntity }: { entity: EntityTab; setEntity: (e: EntityTab) => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-950/30">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 m-0 mb-3">
        Upload entry points
      </p>
      <p className="mb-3 text-xs leading-relaxed text-gray-600 dark:text-gray-400 m-0">
        Four separate paths—one per entity. Any file extension can be chosen; the server validates structure. If parsing
        fails, you will see specific format guidance for that entity (copy will connect to live validation later).
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ENTITY_TABS.map((t) => {
          const active = entity === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setEntity(t.id)}
              className={`rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all duration-200 ${
                active
                  ? "border-indigo-400 bg-indigo-50 text-indigo-950 shadow-sm ring-1 ring-indigo-300/60 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-50 dark:ring-indigo-800/50"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
              }`}
            >
              <span className="block truncate">Upload · {t.label}</span>
              <span className="mt-1 block text-[10px] font-normal text-gray-500 dark:text-gray-400">Picker soon</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FoundryDetailPanel({
  entity,
  setEntity,
}: {
  entity: EntityTab;
  setEntity: (e: EntityTab) => void;
}) {
  const tab = ENTITY_TABS.find((t) => t.id === entity)!;
  const intro = ENTITY_INTRO[entity];
  const bullets = ENTITY_BULLETS[entity];
  const st = ENTITY_STATUS[entity];

  return (
    <div key={entity} className="ta-foundry-detail-enter flex flex-col">
      <FoundryFlowDiagram />

      <div className="mt-5">
        <FoundryUploadEntryPoints entity={entity} setEntity={setEntity} />
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white m-0">{tab.label}</h2>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {st === "later" ? "Roadmap" : "In design"} · {statusLabel(st)}
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400 m-0">{intro}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-950/40">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 m-0 mb-3">
          How it will work
        </p>
        <ul className="m-0 list-none space-y-2.5 p-0">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2.5 text-sm leading-snug text-gray-700 dark:text-gray-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/console/knowledge-base"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Knowledge base →
        </Link>
        <span className="text-xs text-gray-400 dark:text-gray-500">Publish and unpublish happen there.</span>
      </div>
    </div>
  );
}

export default function ConsoleFoundryPage() {
  const [entity, setEntity] = useState<EntityTab>("personas");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gray-50/80 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 border-b border-gray-200/80 pb-8 dark:border-gray-800/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 m-0">
            Console · Foundry
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ConsoleBackToOverview className="self-center" />
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white m-0">Foundry</h1>
            <InfoHint label="Foundry scope" pingTone="violet">
              Per-project LLM generation stays in Project repo. Foundry is ingestion + review; Knowledge base is the
              downstream catalog for members.
            </InfoHint>
          </div>
        </header>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none lg:flex lg:min-h-[min(560px,calc(100vh-14rem))]">
          <nav
            className="flex gap-1 overflow-x-auto border-b border-gray-200 p-2 dark:border-gray-800 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:border-r lg:p-2"
            aria-label="Foundry library sections"
          >
            {ENTITY_TABS.map((t) => {
              const active = entity === t.id;
              const st = ENTITY_STATUS[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEntity(t.id)}
                  className={`group flex min-w-[10.5rem] shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 lg:min-w-0 lg:w-full ${
                    active
                      ? "bg-indigo-50 text-indigo-950 shadow-sm ring-1 ring-indigo-200/90 dark:bg-indigo-950/35 dark:text-indigo-50 dark:ring-indigo-800/60"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:scale-[0.99] dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${
                      active
                        ? "border-indigo-200 bg-white text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
                        : "border-gray-200 bg-gray-50 text-gray-500 group-hover:border-gray-300 group-hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400 dark:group-hover:border-gray-600"
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.label}</span>
                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {statusLabel(st)}
                    </span>
                  </span>
                  {active ? (
                    <span className="hidden h-7 w-1 shrink-0 rounded-full bg-indigo-500 lg:block" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 border-t border-gray-100 p-5 sm:p-8 dark:border-gray-800/80 lg:border-t-0">
            <FoundryDetailPanel entity={entity} setEntity={setEntity} />
          </div>
        </div>
      </div>
    </div>
  );
}
