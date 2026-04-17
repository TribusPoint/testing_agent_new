export const INPUT_CLS =
  "w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500";

export type Candidate = { id: string; name: string; developer_name: string; source: string };

export function connectionTypeLabel(t: string | undefined) {
  if (t === "salesforce") return "Agentforce";
  if (t === "browser") return "Browser";
  if (t === "http") return "HTTP";
  return t || "Agentforce";
}

export const BOOTSTRAP_SESSION_PREFIX = "connections:bootstrap:";

/** Stash bootstrap payload so the connection detail page can hydrate agents/candidates on first open. */
export function storeSalesforceBootstrapSession(
  connectionId: string,
  data: { agents: unknown[]; candidates: unknown[]; message: string; diagnostics?: unknown },
) {
  try {
    sessionStorage.setItem(
      `${BOOTSTRAP_SESSION_PREFIX}${connectionId}`,
      JSON.stringify({
        agents: data.agents,
        candidates: data.candidates,
        message: data.message,
        diagnostics: data.diagnostics ?? null,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
