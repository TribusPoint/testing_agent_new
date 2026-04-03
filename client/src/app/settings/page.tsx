"use client";
import { useState, useEffect } from "react";
import * as api from "@/lib/api";

type LlmConfig = { provider: string; generation_model: string; evaluation_model: string; utterance_model: string };

const INPUT_CLS =
  "w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono";

export default function SettingsPage() {
  const [keyDraft, setKeyDraft] = useState("");
  const [keyName, setKeyName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saved, setSaved] = useState(false);

  // Master key management
  const [masterDraft, setMasterDraft] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<api.ApiKeyCreated | null>(null);
  const [keys, setKeys] = useState<api.ApiKeyInfo[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [masterError, setMasterError] = useState("");
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);

  useEffect(() => {
    const stored = api.getStoredKey();
    if (stored) {
      setKeyDraft(stored);
      verifyAndSet(stored, false);
    }
    api.getLlmConfig().then(setLlmConfig).catch(() => {});
  }, []);

  async function verifyAndSet(key: string, showSaved: boolean) {
    setVerifying(true);
    try {
      const { name } = await api.verifyKey(key);
      setKeyName(name);
      api.setStoredKey(key);
      if (showSaved) setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setKeyName(null);
      if (showSaved) alert("Key is invalid or revoked.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleLoadKeys() {
    setLoadingKeys(true);
    setMasterError("");
    try {
      const list = await api.listApiKeys(masterDraft);
      setKeys(list);
    } catch (e: unknown) {
      setMasterError(e instanceof Error ? e.message : "Failed");
      setKeys([]);
    } finally { setLoadingKeys(false); }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) { alert("Enter a name."); return; }
    setCreating(true);
    setCreatedKey(null);
    try {
      const k = await api.createApiKey(newKeyName.trim(), masterDraft);
      setCreatedKey(k);
      setNewKeyName("");
      await handleLoadKeys();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to create key");
    } finally { setCreating(false); }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this key? It cannot be undone.")) return;
    await api.revokeApiKey(id, masterDraft);
    await handleLoadKeys();
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
      {/* My API Key */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">My API Key</h2>
        <p className="text-xs text-gray-400 mb-4">
          Paste the key you received from your admin. It is stored only in your browser.
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="password"
            className={INPUT_CLS}
            placeholder="ta_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={keyDraft}
            onChange={(e) => { setKeyDraft(e.target.value); setKeyName(null); }}
          />

          {keyName && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Authenticated as <span className="font-semibold">{keyName}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => verifyAndSet(keyDraft, true)}
              disabled={verifying || !keyDraft}
              className="flex-1 text-sm bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {verifying ? "Verifying..." : saved ? "Saved!" : "Save & Verify"}
            </button>
            <button
              onClick={() => { api.clearStoredKey(); setKeyDraft(""); setKeyName(null); }}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      {/* Admin panel */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Admin — Manage Keys</h2>
        <p className="text-xs text-gray-400 mb-4">
          Requires the <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">MASTER_API_KEY</code> from{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">server/.env</code>.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="password"
            className={`flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono`}
            placeholder="Master key"
            value={masterDraft}
            onChange={(e) => setMasterDraft(e.target.value)}
          />
          <button
            onClick={handleLoadKeys}
            disabled={loadingKeys || !masterDraft}
            className="text-sm bg-gray-800 dark:bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium"
          >
            {loadingKeys ? "Loading..." : "Load Keys"}
          </button>
        </div>

        {masterError && <p className="text-xs text-red-500 mb-3">{masterError}</p>}

        {/* Create new key */}
        {masterDraft && (
          <div className="flex gap-2 mb-5">
            <input
              type="text"
              className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="New key name (e.g. alice)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateKey(); }}
            />
            <button
              onClick={handleCreateKey}
              disabled={creating || !newKeyName.trim()}
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {creating ? "Creating..." : "Create Key"}
            </button>
          </div>
        )}

        {/* Newly created key — show once */}
        {createdKey && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">
              Key created for <span className="font-bold">{createdKey.name}</span> — copy it now, it won&apos;t be shown again.
            </p>
            <code className="block text-xs bg-white dark:bg-gray-900 border border-green-200 dark:border-green-700 rounded p-2 break-all select-all text-gray-900 dark:text-white">
              {createdKey.plain_key}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(createdKey.plain_key)}
              className="mt-2 text-xs text-green-700 dark:text-green-400 hover:underline"
            >
              Copy to clipboard
            </button>
          </div>
        )}

        {/* Key list */}
        {keys.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 mb-1">{keys.length} key{keys.length !== 1 ? "s" : ""}</p>
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${k.is_active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{k.name}</p>
                    <p className="text-xs text-gray-400">Created {new Date(k.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {k.is_active && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium"
                  >
                    Revoke
                  </button>
                )}
                {!k.is_active && (
                  <span className="text-xs text-gray-400">Revoked</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* LLM Configuration */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">LLM Configuration</h2>
        <p className="text-xs text-gray-400 mb-4">
          Read-only. Change by editing <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">server/.env</code> and restarting the server.
        </p>

        {llmConfig ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Provider", value: llmConfig.provider, highlight: true },
              { label: "Generation model", value: llmConfig.generation_model },
              { label: "Evaluation model", value: llmConfig.evaluation_model },
              { label: "Utterance model", value: llmConfig.utterance_model },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className={`text-sm font-semibold font-mono ${highlight ? "text-indigo-600 dark:text-indigo-400" : "text-gray-900 dark:text-white"}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            {api.getStoredKey() ? "Loading..." : "Authenticate above to view LLM config."}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 mb-2">To switch to Anthropic/Claude, update <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">server/.env</code>:</p>
          <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-gray-700 dark:text-gray-300 overflow-x-auto">{`LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
GENERATION_MODEL=claude-3-5-sonnet-20241022
EVALUATION_MODEL=claude-3-5-sonnet-20241022
UTTERANCE_MODEL=claude-3-haiku-20240307`}</pre>
        </div>
      </section>
    </div>
  );
}
