"use client";
import { useState, useEffect } from "react";
import * as api from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type LlmConfig = { provider: string; generation_model: string; evaluation_model: string; utterance_model: string };

const INPUT_CLS =
  "w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono";

export default function SettingsPage() {
  const { user } = useAuth();
  const isJwtUser = !!user;
  const [keyDraft, setKeyDraft] = useState("");
  const [keyName, setKeyName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);

  useEffect(() => {
    const stored = api.getStoredKey();
    if (stored) {
      setKeyDraft(stored);
      const t = setTimeout(() => verifyAndSet(stored, false), 800);
      api.getLlmConfig().then(setLlmConfig).catch(() => {});
      return () => clearTimeout(t);
    }
    if (api.getStoredToken()) {
      api.getLlmConfig().then(setLlmConfig).catch(() => {});
    }
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

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  const isAdmin = user?.role === "admin";

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(""); setPwMsg("");
    if (isAdmin && secretCode !== "tribuspoint") { setPwError("Invalid secret code."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    if (newPw.length < 4) { setPwError("Password must be at least 4 characters."); return; }
    setPwLoading(true);
    try {
      const res = await api.changeMyPassword(curPw, newPw);
      setPwMsg(res.message);
      setCurPw(""); setNewPw(""); setConfirmPw(""); setSecretCode("");
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed");
    } finally { setPwLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8 overflow-y-auto">
      {/* Change My Password — only for email/password users */}
      {isJwtUser && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Change My Password</h2>
          <p className="text-xs text-gray-400 mb-4">Update your login password.</p>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3 max-w-sm">
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Secret Code</label>
                <input type="password" placeholder="Enter secret code to proceed" value={secretCode} onChange={(e) => setSecretCode(e.target.value)} required className={INPUT_CLS} />
              </div>
            )}
            <input type="password" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required className={INPUT_CLS} />
            <input type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={4} className={INPUT_CLS} />
            <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required className={INPUT_CLS} />
            {pwError && <p className="text-xs text-red-500">{pwError}</p>}
            {pwMsg && <p className="text-xs text-green-600 dark:text-green-400">{pwMsg}</p>}
            <button type="submit" disabled={pwLoading || !curPw || !newPw || !confirmPw} className="text-sm bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium w-fit px-6">
              {pwLoading ? "Changing..." : "Change Password"}
            </button>
          </form>
        </section>
      )}

      {/* My API Key — only for API-key sessions */}
      {!isJwtUser && (
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
      )}

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
            {(api.getStoredKey() || api.getStoredToken()) ? "Loading..." : "Authenticate to view LLM config."}
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

      <p className="text-xs text-gray-400 text-center">
        User accounts &amp; API key management have moved to <strong className="text-gray-500">Admin Access</strong> in the sidebar.
      </p>
    </div>
  );
}
