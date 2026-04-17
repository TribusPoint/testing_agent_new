"use client";

import type { SiteAnalysis } from "@/lib/api";

const TONE_RING: Record<string, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
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

export function MemberCompanyAnalysisView({
  displayName,
  analysis,
  analyzedAt,
}: {
  displayName: string;
  analysis: SiteAnalysis;
  analyzedAt: string | null;
}) {
  const svc = analysis.services ?? [];
  const aud = analysis.audience_segments ?? [];
  const kws = analysis.keywords ?? [];
  const needs = analysis.user_needs ?? [];
  const analyzedLabel = formatAnalyzedAt(analyzedAt);

  return (
    <div className="flex flex-col gap-8 pb-8">
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
        <h3 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-3">
          Target audience
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {aud.map((item, idx) => (
            <div
              key={item.key ?? `aud-${idx}`}
              className="flex gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-2 py-1.5"
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
        <h3 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-3">Services</h3>
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
        <h3 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-3">Keywords</h3>
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
        <h3 className="text-[11px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-3">User needs</h3>
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
    </div>
  );
}
