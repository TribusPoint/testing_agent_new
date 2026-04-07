"use client";

import type { ReactNode } from "react";
import type { Project, SiteAnalysis } from "@/lib/api";

const TONE_RING: Record<string, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  slate: "bg-slate-500",
};

const TONE_TAG: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30",
  slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30",
  emerald: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30",
  orange: "bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30",
  purple: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30",
};

function ringClass(tone: string) {
  return TONE_RING[tone] ?? TONE_RING.blue;
}

function tagPillClass(tone: string) {
  return TONE_TAG[tone] ?? TONE_TAG.blue;
}

function formatAnalyzedAt(iso: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function SectionHeader({
  icon,
  title,
  compact,
}: {
  icon: ReactNode;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${compact ? "mb-2" : "mb-4"}`}>
      <span className="text-gray-500 dark:text-gray-400 shrink-0">{icon}</span>
      <h3 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">{title}</h3>
    </div>
  );
}

export default function SiteAnalysisPanel({
  project,
  analysis,
  loading,
  overrideUrl,
  onOverrideUrlChange,
  onAnalyze,
  onClassicView,
}: {
  project: Project;
  analysis: SiteAnalysis | null;
  loading: boolean;
  overrideUrl: string;
  onOverrideUrlChange: (v: string) => void;
  onAnalyze: () => void;
  onClassicView: () => void;
}) {
  const analyzedLabel = formatAnalyzedAt(project.site_analyzed_at ?? null);
  const displayName = project.company_name?.trim() || project.name;

  if (!analysis) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{displayName}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Run an AI analysis on the site URL to build the overview (audience, services, keywords, user needs).
            </p>
          </div>
          <button
            type="button"
            onClick={onClassicView}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            Switch to Classic View
          </button>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/80 p-4 sm:p-5 space-y-3">
          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400">Website URL</label>
          <input
            type="url"
            placeholder="https://example.com (defaults to project Websites field)"
            value={overrideUrl}
            onChange={(e) => onOverrideUrlChange(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          {project.company_websites ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Project websites field: <span className="font-mono text-gray-700 dark:text-gray-300">{project.company_websites}</span>
            </p>
          ) : null}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={loading}
            className="text-sm font-medium px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze website"}
          </button>
        </div>
      </div>
    );
  }

  const svc = analysis.services ?? [];
  const aud = analysis.audience_segments ?? [];
  const kws = analysis.keywords ?? [];
  const needs = analysis.user_needs ?? [];

  return (
    <div className="flex flex-col gap-8 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{displayName}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {(analysis.subtitle_tags ?? []).map((t, i) => (
              <span
                key={`${t.label}-${i}`}
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${tagPillClass(t.tone)}`}
              >
                {t.label}
              </span>
            ))}
          </div>
          {analyzedLabel ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Analyzed {analyzedLabel}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClassicView}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
        >
          Switch to Classic View
        </button>
      </div>

      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-4 sm:p-5">
        {analysis.overview_description}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            { label: "SERVICES", value: svc.length, accent: "text-blue-600 dark:text-blue-400" },
            { label: "AUDIENCE SEGMENTS", value: aud.length, accent: "text-emerald-600 dark:text-emerald-400" },
            { label: "KEYWORDS", value: kws.length, accent: "text-orange-600 dark:text-orange-400" },
            { label: "USER NEEDS", value: needs.length, accent: "text-purple-600 dark:text-purple-400" },
          ] as const
        ).map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-900/[0.03] dark:bg-gray-900/50 px-4 py-3"
          >
            <p className={`text-2xl font-bold tabular-nums ${c.accent}`}>{c.value}</p>
            <p className="text-[10px] font-semibold tracking-wide text-gray-500 dark:text-gray-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <section>
        <SectionHeader
          compact
          title="Target audience"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <p className="text-[10px] text-gray-500 dark:text-gray-400 -mt-1 mb-2 max-w-2xl">
          Numbers are list order only (1st segment, 2nd, …)—not counts of people or a score.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {aud.map((item, idx) => (
            <div
              key={item.key ?? `aud-${idx}`}
              className="flex gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-2 py-1.5"
              title={`Audience segment ${idx + 1} of ${aud.length} in this analysis`}
            >
              <div className="flex flex-col items-center shrink-0 gap-0.5 min-w-[1.75rem]">
                <span className={`w-2 h-2 rounded-full ${ringClass(item.tone)}`} aria-hidden />
                <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 tabular-nums leading-none">
                  {idx + 1}/{aud.length}
                </span>
              </div>
              <p className="text-xs text-gray-800 dark:text-gray-200 leading-snug min-w-0">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Services"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {svc.map((item, idx) => (
            <div
              key={item.key ?? `svc-${idx}`}
              className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-3 py-2"
            >
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${ringClass(item.tone)}`} />
              <span className="text-sm text-gray-800 dark:text-gray-200">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Keywords"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          }
        />
        <div className="flex flex-wrap gap-2">
          {kws.map((kw, i) => (
            <span
              key={`${kw}-${i}`}
              className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
            >
              {kw}
            </span>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="User needs"
          icon={
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <div className="grid sm:grid-cols-2 gap-2">
          {needs.map((n, i) => (
            <div
              key={`${n}-${i}`}
              className="flex gap-2 items-start rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-3 py-2"
            >
              <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-800 dark:text-gray-200">{n}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="pt-2">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={loading}
          className="text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Re-analyzing…" : "Re-analyze site"}
        </button>
      </div>
    </div>
  );
}
