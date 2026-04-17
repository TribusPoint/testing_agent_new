import { StatusPing } from "@/components/ui/status-ping";

export default function DashboardPage() {
  return (
    <div className="relative flex-1 min-h-0 h-full overflow-hidden">
      {/* Background layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-100/80 dark:from-gray-950 dark:via-indigo-950/30 dark:to-violet-950/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.5) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative flex h-full min-h-0 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="relative rounded-2xl border border-white/60 bg-white/70 p-8 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/5 backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/75 dark:shadow-indigo-950/40 dark:ring-white/5">
            {/* Top accent line */}
            <div className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent dark:via-indigo-400/30" />

            <div className="flex flex-col items-center text-center">
              {/* Icon cluster */}
              <div className="relative mb-8">
                <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 blur-xl dark:from-indigo-400/15 dark:to-violet-400/15" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 dark:border-indigo-400/30 dark:shadow-indigo-900/50">
                  <svg
                    className="h-10 w-10 text-white drop-shadow-sm"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                    />
                  </svg>
                </div>
                {/* Decorative mini bars */}
                <div className="absolute -right-1 -top-1 flex gap-0.5 opacity-60">
                  <span className="h-3 w-1 rounded-full bg-indigo-300 dark:bg-indigo-500" />
                  <span className="h-5 w-1 rounded-full bg-violet-300 dark:bg-violet-500" />
                  <span className="h-4 w-1 rounded-full bg-indigo-200 dark:bg-indigo-400" />
                </div>
              </div>

              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:border-amber-500/35 dark:bg-amber-950/50 dark:text-amber-200">
                <StatusPing tone="amber" className="relative flex h-2 w-2 shrink-0 items-center justify-center" size="h-2 w-2" />
                Work in progress
              </span>

              <h1 className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-white dark:via-gray-100 dark:to-gray-400 sm:text-3xl">
                Dashboard
              </h1>

              <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                We&apos;re crafting analytics here—run summaries, trends, and quality insights. Check back
                soon for a full picture of how your agents perform across tests.
              </p>

              <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
                <div className="flex items-center gap-3 text-left">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-gray-700/80">
                    <span className="block h-full w-[38%] rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                  </span>
                  <span className="text-[10px] font-medium tabular-nums text-gray-400 dark:text-gray-500">
                    38%
                  </span>
                </div>
                <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
                  Coming soon · metrics &amp; visualizations in development
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
