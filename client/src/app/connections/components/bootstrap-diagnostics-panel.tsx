"use client";

type SoqlStep = {
  query?: string;
  ok?: boolean;
  endpoint?: string;
  totalSize?: unknown;
  new_candidates_from_query?: number;
  error?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Shows auto-discovery + SOQL fallback results returned from bootstrap (Connect / Refresh). */
export function BootstrapDiagnosticsPanel({ data }: { data: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) return null;

  const path = String(data.path ?? "unknown");
  const soqlSteps = Array.isArray(data.soql_fallback_queries) ? (data.soql_fallback_queries as SoqlStep[]) : [];

  return (
    <details className="mt-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-2 py-1.5">
      <summary className="text-xs font-medium cursor-pointer text-gray-700 dark:text-gray-200 select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          Discovery &amp; SOQL trace
          <span className="font-mono text-[10px] font-normal text-gray-500 dark:text-gray-400">({path})</span>
        </span>
      </summary>
      <div className="mt-2 space-y-3 text-[11px] text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 pt-2">
        {path === "salesforce_agent_sync" ? (
          <p className="m-0">
            Agents came from the <strong>Salesforce agents API</strong> sync (
            {String(data.sync_agent_count ?? "?")} row(s)). Runtime discovery and SOQL fallbacks were skipped.
          </p>
        ) : null}

        {path === "discovery_and_soql" ? (
          <>
            {isRecord(data.runtime_discovery) ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 m-0">Runtime discovery</p>
                <p className="m-0 text-gray-600 dark:text-gray-400">
                  Rows from discover_runtime_ids: <strong>{String(data.runtime_discovery.rows ?? 0)}</strong>
                </p>
                {Array.isArray(data.runtime_discovery.errors) && data.runtime_discovery.errors.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-200 m-0 mb-0.5">Errors</p>
                    <ul className="m-0 pl-4 list-disc text-[10px] text-amber-900 dark:text-amber-100 space-y-0.5">
                      {(data.runtime_discovery.errors as string[]).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="m-0 text-[10px] text-gray-500">No discovery errors reported.</p>
                )}
                {data.runtime_discovery.instructions ? (
                  <p className="m-0 text-[10px] text-gray-600 dark:text-gray-400 italic">
                    {String(data.runtime_discovery.instructions)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {soqlSteps.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 m-0 mb-1">
                  SOQL fallbacks (same order as server)
                </p>
                <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                        <th className="p-1.5 font-medium">Query</th>
                        <th className="p-1.5 font-medium w-12">OK</th>
                        <th className="p-1.5 font-medium w-14">Total</th>
                        <th className="p-1.5 font-medium w-16">New</th>
                        <th className="p-1.5 font-medium">Endpoint / error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {soqlSteps.map((step, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 align-top">
                          <td className="p-1.5 font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all max-w-[220px]">
                            {step.query ?? "—"}
                          </td>
                          <td className="p-1.5">{step.ok ? "yes" : "no"}</td>
                          <td className="p-1.5 font-mono">{step.totalSize != null ? String(step.totalSize) : "—"}</td>
                          <td className="p-1.5 font-mono">
                            {step.new_candidates_from_query != null ? String(step.new_candidates_from_query) : "—"}
                          </td>
                          <td className="p-1.5 font-mono text-gray-600 dark:text-gray-400 break-all max-w-[280px]">
                            {step.error ? (
                              <span className="text-red-600 dark:text-red-400">{step.error}</span>
                            ) : (
                              step.endpoint || "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 m-0 text-[10px] text-gray-500 dark:text-gray-400">
                  “New” = candidate rows merged from that query (deduped against agents and prior candidates).
                </p>
              </div>
            ) : null}

            <p className="m-0 text-[10px] text-gray-600 dark:text-gray-400">
              Candidates after this run: <strong>{String(data.candidates_total ?? "—")}</strong>
            </p>
          </>
        ) : null}

        {path === "error" ? (
          <p className="m-0 text-red-700 dark:text-red-300">
            <strong>{String(data.phase ?? "error")}:</strong> {String(data.error ?? "unknown")}
          </p>
        ) : null}

        {path === "non_salesforce" ? <p className="m-0">{String(data.note ?? "")}</p> : null}

        <details className="text-[10px]">
          <summary className="cursor-pointer text-gray-500 dark:text-gray-400">Raw JSON</summary>
          <pre className="mt-1 max-h-56 overflow-auto rounded bg-white dark:bg-gray-950 p-2 border border-gray-200 dark:border-gray-800 font-mono text-[10px] leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    </details>
  );
}
