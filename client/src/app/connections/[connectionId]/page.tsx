"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { AgentforceConnectionDetail } from "../components/agentforce-connection-detail";
import { BrowserConnectionWip } from "../components/browser-connection-wip";
import { connectionTypeLabel } from "../lib/constants";

function connectionIdFromParams(connectionId: string | string[] | undefined): string {
  if (typeof connectionId === "string") return connectionId;
  if (Array.isArray(connectionId)) return connectionId[0] ?? "";
  return "";
}

export default function ConnectionDetailPage() {
  const params = useParams();
  const id = connectionIdFromParams(params.connectionId);
  const [conn, setConn] = useState<api.Connection | null | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setConn(null);
      return;
    }
    let cancelled = false;
    api
      .getConnection(id)
      .then((c) => {
        if (!cancelled) setConn(c);
      })
      .catch(() => {
        if (!cancelled) setConn(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (conn === undefined) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center bg-gray-50 dark:bg-gray-950 text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!conn) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950 p-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Connection not found.</p>
        <Link href="/connections" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
          ← All connections
        </Link>
      </div>
    );
  }

  if ((conn.connection_type || "salesforce") === "salesforce") {
    return (
      <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
        <AgentforceConnectionDetail connection={conn} />
      </div>
    );
  }

  if (conn.connection_type === "browser") {
    return (
      <div className="flex flex-1 min-h-0 flex-col bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
        <Link href="/connections" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium mb-3 w-fit">
          ← All connections
        </Link>
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{conn.name}</h1>
        <p className="text-[10px] text-gray-400 mb-4">Type: {connectionTypeLabel(conn.connection_type)}</p>
        <div className="max-w-lg">
          <BrowserConnectionWip />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
      <Link href="/connections" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium mb-3 w-fit">
        ← All connections
      </Link>
      <h1 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{conn.name}</h1>
      <p className="text-xs text-gray-500 mb-2">Type: {connectionTypeLabel(conn.connection_type)}</p>
      <p className="text-xs text-gray-500 max-w-md">
        This connection type is not shown in the Agentforce editor yet. Use the API or switch the connection to Agentforce
        from the backend if needed.
      </p>
    </div>
  );
}
