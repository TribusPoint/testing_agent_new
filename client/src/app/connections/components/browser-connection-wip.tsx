import { StatusPing } from "@/components/ui/status-ping";

export function BrowserConnectionWip() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-purple-200/80 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/80 p-6 dark:border-purple-800/50 dark:from-violet-950/40 dark:via-gray-900 dark:to-indigo-950/30">
      <div className="absolute left-4 right-4 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent dark:via-purple-500/30" />
      <div className="flex flex-col items-center text-center pt-2">
        <div className="relative mb-5">
          <div className="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-tr from-violet-500/15 to-purple-500/15 blur-lg" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-purple-200/80 bg-gradient-to-br from-violet-600 to-purple-700 shadow-md dark:border-purple-500/30">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0v18"
              />
            </svg>
          </div>
        </div>
        <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:border-amber-500/35 dark:bg-amber-950/50 dark:text-amber-200">
          <StatusPing tone="amber" className="relative flex h-2 w-2 shrink-0 items-center justify-center" size="h-2 w-2" />
          Work in progress
        </span>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Browser connections</h3>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400 max-w-sm">
          Headless browser connections—page URLs, chat widget selectors, and verification flows—will be configured here.
          For now, use <strong>Agentforce</strong> for Salesforce org agents.
        </p>
        <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
          <div className="flex items-center gap-3 text-left">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-gray-700/80">
              <span className="block h-full w-[38%] rounded-full bg-gradient-to-r from-violet-500 to-purple-600" />
            </span>
            <span className="text-[10px] font-medium tabular-nums text-gray-400 dark:text-gray-500">38%</span>
          </div>
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">Coming soon · browser setup in development</p>
        </div>
      </div>
    </div>
  );
}
