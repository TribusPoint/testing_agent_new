"use client";

import Link from "next/link";
import { InfoHint } from "@/components/ui/info-hint";

type BentoVariant = "indigo" | "violet" | "cyan" | "fuchsia";

const VARIANT_STYLES: Record<
  BentoVariant,
  {
    orb: string;
    border: string;
    hoverBorder: string;
    iconWrap: string;
    chip: string;
    arrow: string;
    titleHover: string;
  }
> = {
  indigo: {
    orb: "bg-indigo-400/25 dark:bg-indigo-500/20",
    border: "border-indigo-200/70 dark:border-indigo-900/60",
    hoverBorder: "group-hover:border-indigo-400/80 dark:group-hover:border-indigo-600/70",
    iconWrap:
      "bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-700 ring-indigo-200/80 dark:from-indigo-950/80 dark:to-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-800/50",
    chip: "bg-indigo-100/90 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200",
    arrow: "group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:group-hover:bg-indigo-950 dark:group-hover:text-indigo-300",
    titleHover: "group-hover:text-indigo-950 dark:group-hover:text-indigo-50",
  },
  violet: {
    orb: "bg-violet-400/25 dark:bg-violet-500/20",
    border: "border-violet-200/70 dark:border-violet-900/55",
    hoverBorder: "group-hover:border-violet-400/75 dark:group-hover:border-violet-600/65",
    iconWrap:
      "bg-gradient-to-br from-violet-100 to-fuchsia-50 text-violet-800 ring-violet-200/80 dark:from-violet-950/70 dark:to-violet-950/35 dark:text-violet-100 dark:ring-violet-800/45",
    chip: "bg-violet-100/90 text-violet-900 dark:bg-violet-950/80 dark:text-violet-100",
    arrow: "group-hover:bg-violet-100 group-hover:text-violet-800 dark:group-hover:bg-violet-950 dark:group-hover:text-violet-200",
    titleHover: "group-hover:text-violet-950 dark:group-hover:text-violet-50",
  },
  cyan: {
    orb: "bg-cyan-400/25 dark:bg-cyan-500/18",
    border: "border-cyan-200/70 dark:border-cyan-900/55",
    hoverBorder: "group-hover:border-cyan-400/80 dark:group-hover:border-cyan-600/60",
    iconWrap:
      "bg-gradient-to-br from-cyan-100 to-sky-50 text-cyan-900 ring-cyan-200/70 dark:from-cyan-950/70 dark:to-sky-950/30 dark:text-cyan-100 dark:ring-cyan-800/45",
    chip: "bg-cyan-100/90 text-cyan-900 dark:bg-cyan-950/80 dark:text-cyan-100",
    arrow: "group-hover:bg-cyan-100 group-hover:text-cyan-900 dark:group-hover:bg-cyan-950 dark:group-hover:text-cyan-200",
    titleHover: "group-hover:text-cyan-950 dark:group-hover:text-cyan-50",
  },
  fuchsia: {
    orb: "bg-fuchsia-400/20 dark:bg-fuchsia-500/15",
    border: "border-fuchsia-200/65 dark:border-fuchsia-900/50",
    hoverBorder: "group-hover:border-fuchsia-400/75 dark:group-hover:border-fuchsia-600/55",
    iconWrap:
      "bg-gradient-to-br from-fuchsia-100 to-violet-50 text-fuchsia-900 ring-fuchsia-200/70 dark:from-fuchsia-950/65 dark:to-violet-950/35 dark:text-fuchsia-100 dark:ring-fuchsia-800/40",
    chip: "bg-fuchsia-100/90 text-fuchsia-950 dark:bg-fuchsia-950/75 dark:text-fuchsia-100",
    arrow: "group-hover:bg-fuchsia-100 group-hover:text-fuchsia-900 dark:group-hover:bg-fuchsia-950 dark:group-hover:text-fuchsia-200",
    titleHover: "group-hover:text-fuchsia-950 dark:group-hover:text-fuchsia-50",
  },
};

function CompactToolCard({
  href,
  title,
  desc,
  badge,
  variant,
  delay,
  children,
}: {
  href: string;
  title: string;
  desc: string;
  badge: string;
  variant: BentoVariant;
  delay: number;
  children: React.ReactNode;
}) {
  const v = VARIANT_STYLES[variant];
  return (
    <li className="ta-console-rise flex min-h-0" style={{ ["--ta-rise-delay" as string]: `${delay}ms` }}>
      <Link
        href={href}
        className={`group relative flex w-full min-h-[6.5rem] flex-1 flex-row items-stretch gap-2.5 overflow-hidden rounded-xl border bg-gradient-to-br from-white via-white to-gray-50/90 p-3 shadow-sm ring-1 ring-black/[0.03] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/[0.06] active:translate-y-0 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900/95 dark:ring-white/[0.06] sm:min-h-0 ${v.border} ${v.hoverBorder}`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl opacity-60 transition-opacity group-hover:opacity-90 ${v.orb}`}
        />
        <span
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 transition-transform duration-300 group-hover:scale-105 ${v.iconWrap}`}
        >
          {children}
        </span>
        <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <div className="flex items-start justify-between gap-1.5">
            <h3
              className={`text-sm font-bold leading-tight tracking-tight text-gray-900 transition-colors duration-200 dark:text-white ${v.titleHover}`}
            >
              {title}
            </h3>
            <span className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:inline ${v.chip}`}>{badge}</span>
          </div>
          <p className="line-clamp-2 text-[11px] leading-snug text-gray-600 dark:text-gray-400">{desc}</p>
        </div>
        <span
          className={`relative mt-auto flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full bg-gray-100 text-gray-400 transition-all duration-300 group-hover:translate-x-0.5 dark:bg-gray-800 dark:text-gray-500 ${v.arrow}`}
          aria-hidden
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </Link>
    </li>
  );
}

function AccountCard({
  href,
  title,
  desc,
  delay,
  children,
}: {
  href: string;
  title: string;
  desc: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <li className="ta-console-rise min-h-0" style={{ ["--ta-rise-delay" as string]: `${delay}ms` }}>
      <Link
        href={href}
        className="group flex h-full min-h-[3.25rem] items-center gap-2.5 overflow-hidden rounded-xl border border-gray-200/90 bg-white/90 p-2.5 shadow-sm ring-1 ring-black/[0.03] transition-all duration-300 hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-950/90 dark:ring-white/[0.05] dark:hover:border-gray-600"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-transform group-hover:scale-105 dark:bg-gray-800 dark:text-gray-300">
          {children}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight text-gray-900 dark:text-white">{title}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">{desc}</span>
        </span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  );
}

function PipelineDecor() {
  return (
    <div
      className="ta-console-rise flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-gray-200/80 bg-white/70 px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-400 sm:justify-end"
      style={{ ["--ta-rise-delay" as string]: "40ms" }}
    >
      <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">Foundry</span>
      <span className="text-gray-300 dark:text-gray-600" aria-hidden>
        →
      </span>
      <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100">KB</span>
      <span className="text-gray-300 dark:text-gray-600" aria-hidden>
        →
      </span>
      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-800 dark:bg-gray-800 dark:text-gray-200">App</span>
    </div>
  );
}

function SectionHeading({ id, title, badge }: { id?: string; title: string; badge?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/70 pb-1.5 dark:border-gray-800">
      <h2 id={id} className="m-0 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600 dark:text-gray-400">
        {title}
      </h2>
      {badge ? (
        <span className="rounded-full border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function OverviewSections() {
  return (
    <div className="ta-console-rise flex min-h-0 flex-1 flex-col gap-4 border-t border-gray-200/80 pt-2 dark:border-gray-800" style={{ ["--ta-rise-delay" as string]: "60ms" }}>
      <section aria-labelledby="overview-workspace-heading" className="min-h-0">
        <SectionHeading id="overview-workspace-heading" title="Workspace tools" />
        <ul className="grid min-h-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-4 lg:gap-2.5 [&>li]:min-h-0">
          <CompactToolCard
            href="/console/content"
            title="Foundry"
            desc="Uploads, drafts, and review before Knowledge base."
            badge="Ingest"
            variant="indigo"
            delay={40}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </CompactToolCard>
          <CompactToolCard
            href="/console/knowledge-base"
            title="Knowledge base"
            desc="Published subset for testers; publish / unpublish."
            badge="Publish"
            variant="violet"
            delay={55}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
              />
            </svg>
          </CompactToolCard>
          <CompactToolCard
            href="/console/project-repo"
            title="Project repo"
            desc="Per-project LLM generation for personas, dimensions, profiles, questions."
            badge="Repo"
            variant="cyan"
            delay={70}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
              />
            </svg>
          </CompactToolCard>
          <CompactToolCard
            href="/console/llm"
            title="LLM configuration"
            desc="Provider keys and model defaults for generation."
            badge="Models"
            variant="fuchsia"
            delay={85}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 00-.659 1.59V21.5M5 14.5l2.47 2.47a2.25 2.25 0 01.659 1.59V21.5m0 0h8.691"
              />
            </svg>
          </CompactToolCard>
        </ul>
      </section>

      <section aria-labelledby="overview-governance-heading">
        <SectionHeading title="Governance" />
        <div className="ta-console-rise grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5" style={{ ["--ta-rise-delay" as string]: "20ms" }}>
          <ul className="contents">
            <AccountCard href="/console/change-password" title="Change password" desc="Update your credentials" delay={100}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </AccountCard>
            <AccountCard href="/console/access" title="Admin access" desc="Approvals and accounts" delay={115}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </AccountCard>
          </ul>
        </div>
      </section>

      <section aria-labelledby="overview-settings-heading" className="pb-0.5">
        <SectionHeading id="overview-settings-heading" title="Settings" badge="Work in progress" />
        <div
          className="ta-console-rise group relative flex min-h-[3.25rem] flex-col justify-center overflow-hidden rounded-xl border border-dashed border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-gray-50/90 p-2.5 opacity-95 shadow-sm dark:border-amber-900/40 dark:from-amber-950/20 dark:via-gray-950 dark:to-gray-900/80"
          style={{ ["--ta-rise-delay" as string]: "20ms" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <p className="m-0 text-sm font-semibold text-gray-900 dark:text-white">Console settings</p>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Not available yet—preview only.</span>
              <InfoHint label="Console settings" pingSize="h-3 w-3">
                Preferences and options for this admin workspace will be configured here later.
              </InfoHint>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/90 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-100">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50 dark:bg-amber-500" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
              </span>
              WIP
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ConsoleHomePage() {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto lg:overflow-y-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-25%,rgba(99,102,241,0.12),transparent)] dark:bg-[radial-gradient(ellipse_90%_55%_at_50%_-25%,rgba(99,102,241,0.08),transparent)]" />
        <div className="absolute right-[-15%] top-[5%] h-[min(50vw,22rem)] w-[min(50vw,22rem)] rounded-full bg-gradient-to-bl from-violet-400/10 via-transparent to-transparent blur-3xl dark:from-violet-500/8" />
        <div
          className="absolute inset-0 opacity-[0.28] dark:opacity-[0.18]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.12'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 lg:gap-2 lg:py-2">
        <header
          className="ta-console-rise shrink-0 overflow-hidden rounded-2xl border border-indigo-200/40 bg-gradient-to-br from-white/95 via-indigo-50/35 to-violet-50/25 p-3 shadow-md shadow-indigo-500/[0.05] ring-1 ring-indigo-500/10 dark:border-indigo-900/40 dark:from-gray-950/95 dark:via-indigo-950/25 dark:to-violet-950/15 dark:ring-indigo-500/12 sm:p-4"
          style={{ ["--ta-rise-delay" as string]: "0ms" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-400/15 to-violet-500/10 blur-3xl dark:from-indigo-500/12"
          />
          <div className="relative flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px]">
                <span className="inline-flex items-center rounded-full border border-indigo-200/80 bg-white/90 px-2 py-0.5 font-semibold uppercase tracking-wider text-indigo-700 shadow-sm dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-200">
                  Console
                </span>
                <span className="font-medium text-gray-500 dark:text-gray-400">Admin workspace</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="m-0 text-2xl font-black tracking-[-0.03em] sm:text-3xl lg:text-4xl">
                  <span className="bg-gradient-to-r from-gray-900 via-indigo-900 to-violet-800 bg-clip-text text-transparent dark:from-white dark:via-indigo-100 dark:to-violet-200">
                    Overview
                  </span>
                </h1>
                <InfoHint label="What this overview is for" className="mt-0.5" pingSize="h-3.5 w-3.5">
                  Foundry and Knowledge base are also in the sidebar. Sections below stack in order: workspace links,
                  governance, then settings (settings is work in progress).
                </InfoHint>
              </div>
            </div>
            <div className="w-full shrink-0 lg:w-auto lg:max-w-md">
              <PipelineDecor />
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:min-h-0">
          <OverviewSections />
        </div>
      </div>
    </div>
  );
}
