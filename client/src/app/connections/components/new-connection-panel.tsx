"use client";

import { useState } from "react";
import * as api from "@/lib/api";
import { usePersistedState } from "@/lib/usePersistedState";
import { BrowserConnectionWip } from "./browser-connection-wip";
import { INPUT_CLS } from "../lib/constants";

type NewConnKind = "agentforce" | "browser";

export function NewConnectionPanel({
  onCreated,
}: {
  onCreated: (payload: api.ConnectionAgentsPayload) => void | Promise<void>;
}) {
  const [newConnKind, setNewConnKind] = usePersistedState<NewConnKind>("connections:newConnKind", "agentforce");
  const [form, setForm] = usePersistedState("connections:form", {
    name: "",
    domain: "",
    consumer_key: "",
    consumer_secret: "",
  });
  const [saving, setSaving] = useState(false);

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const name = String(form.name ?? "").trim();
  const domain = String(form.domain ?? "").trim();
  const consumerKey = String(form.consumer_key ?? "").trim();
  const consumerSecret = String(form.consumer_secret ?? "").trim();
  const canSave = Boolean(name && domain && consumerKey && consumerSecret);

  async function handleSaveNew() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = await api.createConnection({
        connection_type: "salesforce",
        name,
        domain,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      });
      await Promise.resolve(onCreated(payload));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        {(
          [
            { id: "agentforce" as const, label: "Agentforce" },
            { id: "browser" as const, label: "Browser" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setNewConnKind(id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              newConnKind === id
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {newConnKind === "agentforce" ? (
        <div className="flex flex-col gap-2 max-w-lg">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Salesforce org: name, domain, consumer key, and secret. Save stores the connection; use Connect in the list
            to authenticate and sync agents.
          </p>
          <input placeholder="Connection name" value={form.name ?? ""} onChange={field("name")} className={INPUT_CLS} />
          <input
            placeholder="Domain (e.g. org.my.salesforce.com)"
            value={form.domain ?? ""}
            onChange={field("domain")}
            className={INPUT_CLS}
          />
          <input placeholder="Consumer key" value={form.consumer_key ?? ""} onChange={field("consumer_key")} className={INPUT_CLS} />
          <input
            type="password"
            placeholder="Consumer secret"
            value={form.consumer_secret ?? ""}
            onChange={field("consumer_secret")}
            className={INPUT_CLS}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleSaveNew()}
              disabled={saving || !canSave}
              className="flex-1 text-xs bg-indigo-600 text-white py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <BrowserConnectionWip />
      )}
    </div>
  );
}
