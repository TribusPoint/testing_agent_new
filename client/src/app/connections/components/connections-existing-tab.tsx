"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import * as api from "@/lib/api";
import TstAgntTable, { type TstAgntColumnConfig } from "@/components/ui/tst-agnt-table";
import { connectionTypeLabel, storeSalesforceBootstrapSession } from "../lib/constants";

export function ConnectionsExistingTab({
  connections,
  onListChange,
}: {
  connections: api.Connection[];
  onListChange?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const connTableRows = connections.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain || "—",
    type: connectionTypeLabel(c.connection_type),
    _actions: "",
    _conn: c,
  }));

  async function handleConnect(c: api.Connection) {
    if ((c.connection_type || "salesforce") !== "salesforce") return;
    setConnectingId(c.id);
    try {
      const payload = await api.bootstrapSalesforceConnection(c.id);
      storeSalesforceBootstrapSession(c.id, {
        agents: payload.agents,
        candidates: payload.candidates,
        message: payload.message,
        diagnostics: payload.diagnostics,
      });
      router.push(`/connections/${c.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setConnectingId(null);
    }
  }

  async function handleDelete(c: api.Connection) {
    if (!confirm(`Delete connection "${c.name}" and all its agents?`)) return;
    setDeletingId(c.id);
    try {
      await api.deleteConnection(c.id);
      await Promise.resolve(onListChange?.());
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const connTableColumns: TstAgntColumnConfig<(typeof connTableRows)[0]>[] = [
    { key: "name", label: "Name", searchable: true },
    { key: "type", label: "Type", searchable: true },
    { key: "domain", label: "Domain", searchable: true },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      searchable: false,
      renderCell: (_v, row) => {
        const c = row._conn;
        const isSf = (c.connection_type || "salesforce") === "salesforce";
        const connecting = connectingId === c.id;
        const deleting = deletingId === c.id;
        return (
          <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {isSf ? (
              <button
                type="button"
                disabled={connecting || deleting}
                onClick={() => void handleConnect(c)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {connecting ? "Connecting…" : "Connect"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={connecting || deleting}
              onClick={() => void handleDelete(c)}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-4">
      <TstAgntTable
        data={connTableRows}
        columns={connTableColumns}
        enableSearch
        searchPlaceholder="Search connections…"
        pagination={{ enabled: true, rowsPerPage: 10 }}
        onRowClick={(row) => router.push(`/connections/${row._conn.id}`)}
        emptyState={
          <p className="text-xs text-gray-400 py-4">
            No connections yet — click + Connection to add one, then Connect in the list to sync agents.
          </p>
        }
      />
    </div>
  );
}
