"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { InfoHint } from "@/components/ui/info-hint";
import { ConnectionsExistingTab } from "./components/connections-existing-tab";
import { NewConnectionPanel } from "./components/new-connection-panel";

export default function ConnectionsPage() {
  const pathname = usePathname();
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [connections, setConnections] = useState<api.Connection[]>([]);

  const loadConnections = useCallback(async () => {
    try {
      setConnections(await api.listConnections());
    } catch {
      setConnections([]);
    }
  }, []);

  useEffect(() => {
    if (pathname === "/connections") void loadConnections();
  }, [pathname, loadConnections]);

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white m-0">Connections</h2>
          <InfoHint label="Connections">
            Saved connections appear in the list. For Agentforce, use <strong>Connect</strong> to authenticate and
            sync agents, or click a row to open settings. <strong>+ Connection</strong> adds credentials (Save only);
            connect from the table.
          </InfoHint>
        </div>
        {!showNewConnection ? (
          <button
            type="button"
            onClick={() => setShowNewConnection(true)}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 shrink-0"
          >
            + Connection
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowNewConnection(false)}
            className="text-xs text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shrink-0"
          >
            ← Back to list
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {showNewConnection ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">New connection</p>
            <NewConnectionPanel
              onCreated={async () => {
                await loadConnections();
                setShowNewConnection(false);
              }}
            />
          </div>
        ) : (
          <ConnectionsExistingTab connections={connections} onListChange={loadConnections} />
        )}
      </div>
    </div>
  );
}
