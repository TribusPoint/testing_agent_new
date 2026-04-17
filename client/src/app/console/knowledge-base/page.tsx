"use client";

import Link from "next/link";
import { useState } from "react";
import { ConsoleBackToOverview } from "@/components/console/console-back-to-overview";
import { InfoHint } from "@/components/ui/info-hint";
import { ENTITY_TABS, type EntityTab } from "@/components/settings/entity-tabs";

const KB_INTRO: Record<EntityTab, string> = {
  personas:
    "Shows what testers can use after you publish from Foundry. Unpublish hides it from the app without deleting the Foundry draft.",
  dimensions:
    "Published dimensions define what members can select during runs. Stage changes in Foundry, then release them here.",
  profiles:
    "Profile packs appear for testers only after publication. Iteration stays in Foundry until you are ready.",
  questions:
    "Question banks in the app are a curated subset. Keep bulk edits in Foundry, then publish stable cuts from here.",
};

const KB_BULLETS: Record<EntityTab, string[]> = {
  personas: [
    "Publish / unpublish controls what appears in member-facing flows.",
    "Uploads always start in Foundry—this tab never replaces those entry points.",
    "Tenant- or industry-specific targeting comes later; the four-section layout stays the same.",
  ],
  dimensions: [
    "Publish pushes an approved Foundry dimension set to testers.",
    "Unpublish hides it immediately while keeping the Foundry source intact.",
    "No direct file upload on this page by design.",
  ],
  profiles: [
    "Profiles follow the same publish contract as other entities.",
    "Stage bundles in Foundry, then release them from this workspace.",
  ],
  questions: [
    "Ship question banks only after validation in Foundry.",
    "Unpublish is the rollback path if something regresses in the field.",
  ],
};

function KnowledgeBaseFlowDiagram() {
  const step =
    "flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300";
  const arrow = "text-gray-300 dark:text-gray-600 select-none";
  return (
    <div
      className="flex flex-col items-stretch gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-center sm:gap-2 dark:border-gray-800 dark:bg-gray-900/40"
      aria-hidden
    >
      <div className={step}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-[10px] font-bold text-violet-600 shadow-sm dark:bg-gray-900 dark:text-violet-300">
          1
        </span>
        Foundry (approved)
      </div>
      <span className={`${arrow} hidden sm:block`}>→</span>
      <span className={`${arrow} text-center sm:hidden`}>↓</span>
      <div className={step}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-[10px] font-bold text-violet-600 shadow-sm dark:bg-gray-900 dark:text-violet-300">
          2
        </span>
        Knowledge base
      </div>
      <span className={`${arrow} hidden sm:block`}>→</span>
      <span className={`${arrow} text-center sm:hidden`}>↓</span>
      <div className={step}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-[10px] font-bold text-violet-600 shadow-sm dark:bg-gray-900 dark:text-violet-300">
          3
        </span>
        Testing Agent app
      </div>
    </div>
  );
}

function KnowledgeBaseDetailPanel({ entity }: { entity: EntityTab }) {
  const tab = ENTITY_TABS.find((t) => t.id === entity)!;
  return (
    <div key={entity} className="ta-foundry-detail-enter flex flex-col">
      <KnowledgeBaseFlowDiagram />

      <div className="mt-6 flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white m-0">{tab.label}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400 m-0">{KB_INTRO[entity]}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-950/40">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 m-0 mb-3">
          Operator notes
        </p>
        <ul className="m-0 list-none space-y-2.5 p-0">
          {KB_BULLETS[entity].map((b) => (
            <li key={b} className="flex gap-2.5 text-sm leading-snug text-gray-700 dark:text-gray-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500 dark:bg-violet-400" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white opacity-50 shadow-sm cursor-not-allowed dark:bg-violet-500"
        >
          Publish from Foundry
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 opacity-50 cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          Unpublish
        </button>
      </div>
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 m-0">
        Publish and unpublish actions activate once Foundry ingestion is wired.
      </p>

      <p className="mt-6 text-sm m-0">
        <Link
          href="/console/content"
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to Foundry
        </Link>
      </p>
    </div>
  );
}

export default function ConsoleKnowledgeBasePage() {
  const [entity, setEntity] = useState<EntityTab>("personas");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gray-50/80 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 border-b border-gray-200/80 pb-8 dark:border-gray-800/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 m-0">
            Console · Knowledge base
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ConsoleBackToOverview className="self-center" />
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white m-0">Knowledge base</h1>
            <InfoHint label="Why this exists">
              Foundry is the full workshop. Knowledge base is the intentional slice you publish for end users.
            </InfoHint>
          </div>
        </header>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none lg:flex lg:min-h-[min(520px,calc(100vh-14rem))]">
          <nav
            className="flex gap-1 overflow-x-auto border-b border-gray-200 p-2 dark:border-gray-800 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:border-r lg:p-2"
            aria-label="Knowledge base sections"
          >
            {ENTITY_TABS.map((t) => {
              const active = entity === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEntity(t.id)}
                  className={`group flex min-w-[10.5rem] shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 lg:min-w-0 lg:w-full ${
                    active
                      ? "bg-violet-50 text-violet-950 shadow-sm ring-1 ring-violet-200/90 dark:bg-violet-950/30 dark:text-violet-50 dark:ring-violet-800/60"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:scale-[0.99] dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${
                      active
                        ? "border-violet-200 bg-white text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                        : "border-gray-200 bg-gray-50 text-gray-500 group-hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.label}</span>
                  {active ? (
                    <span className="hidden h-7 w-1 shrink-0 rounded-full bg-violet-500 lg:block" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 border-t border-gray-100 p-5 sm:p-8 dark:border-gray-800/80 lg:border-t-0">
            <KnowledgeBaseDetailPanel entity={entity} />
          </div>
        </div>
      </div>
    </div>
  );
}
