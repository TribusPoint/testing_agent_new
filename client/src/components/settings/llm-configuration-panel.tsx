"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { InfoHint } from "@/components/ui/info-hint";
import { StatusPing } from "@/components/ui/status-ping";
import * as api from "@/lib/api";
import type { LlmConfig, LlmProviderId } from "@/lib/api";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(
      () =>
        reject(
          new Error(
            `Request timed out after ${Math.round(ms / 1000)}s. Start the API server, or if you use NEXT_PUBLIC_API_URL ensure it is correct and CORS allows this origin.`,
          ),
        ),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

function IconLlm({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 00-.659 1.59V21.5M5 14.5l2.47 2.47a2.25 2.25 0 01.659 1.59V21.5m0 0h8.691"
      />
    </svg>
  );
}

function normalizeProviderId(raw: string | undefined): LlmProviderId {
  const p = (raw || "openai").toLowerCase();
  if (p === "anthropic" || p === "gemini" || p === "openai") return p;
  return "openai";
}

const PROVIDERS: {
  id: LlmProviderId;
  label: string;
  keyField: "openai_key_set" | "anthropic_key_set" | "gemini_key_set";
}[] = [
  { id: "openai", label: "OpenAI", keyField: "openai_key_set" },
  { id: "anthropic", label: "Anthropic (Claude)", keyField: "anthropic_key_set" },
  { id: "gemini", label: "Google Gemini", keyField: "gemini_key_set" },
];

export function LlmConfigurationPanel({ showHero = true }: { showHero?: boolean }) {
  const { isAuthenticated } = useAuth();
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmError, setLlmError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      setLlmConfig(null);
      setLlmError("");
      return;
    }
    let cancelled = false;
    setLlmError("");
    withTimeout(api.getLlmConfig(), 25_000)
      .then((c) => {
        if (!cancelled) setLlmConfig(c);
      })
      .catch((e) => {
        if (!cancelled) {
          setLlmError(e instanceof Error ? e.message : "Failed to load LLM config");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  async function onProviderChange(next: LlmProviderId) {
    if (!llmConfig) return;
    const ready =
      next === "openai"
        ? llmConfig.openai_key_set
        : next === "anthropic"
          ? llmConfig.anthropic_key_set
          : llmConfig.gemini_key_set;
    if (!ready) return;
    setLlmError("");
    setLlmSaving(true);
    try {
      const cfg = await api.updateLlmProvider(next);
      setLlmConfig(cfg);
    } catch (e: unknown) {
      setLlmError(e instanceof Error ? e.message : "Failed to update provider");
    } finally {
      setLlmSaving(false);
    }
  }

  const currentId = llmConfig ? normalizeProviderId(llmConfig.provider) : "openai";

  return (
    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
      {showHero && (
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <IconLlm className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">LLM configuration</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose the active provider. Keys are configured server-side (environment variables or{" "}
              <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">.env</code>). You can only
              switch to a provider whose key is set. Changing provider updates all task models to that provider&apos;s
              defaults.
            </p>
          </div>
        </div>
      )}
      {!showHero && (
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white m-0">LLM configuration</h2>
          <InfoHint label="LLM configuration">
            Choose the active provider. Keys are configured server-side (environment variables or{" "}
            <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">.env</code>). You can only
            switch to a provider whose key is set. Changing provider updates all task models to that provider&apos;s
            defaults.
          </InfoHint>
        </div>
      )}
      {llmError && <p className="text-xs text-red-500 mb-2">{llmError}</p>}

      {llmConfig ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <label htmlFor="llm-provider-select" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Active provider
            </label>
            <select
              id="llm-provider-select"
              value={currentId}
              onChange={(e) => onProviderChange(e.target.value as LlmProviderId)}
              disabled={llmSaving}
              className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-w-[14rem]"
            >
              {PROVIDERS.map(({ id, label, keyField }) => {
                const ready = llmConfig[keyField];
                const isCurrent = id === currentId;
                return (
                  <option key={id} value={id} disabled={!ready && !isCurrent}>
                    {!ready && !isCurrent ? `${label} — key not set` : label}
                  </option>
                );
              })}
            </select>
            {llmSaving && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <StatusPing tone="amber" className="relative flex h-2 w-2 shrink-0" size="h-2 w-2" />
                Saving…
              </span>
            )}
          </div>

          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Provider credentials
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {PROVIDERS.map(({ label, keyField }) => {
              const active = llmConfig[keyField];
              return (
                <div
                  key={label}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    <StatusPing
                      tone={active ? "green" : "red"}
                      className="relative flex h-2 w-2 shrink-0"
                      size="h-2 w-2"
                    />
                    {active ? "Active" : "Not set"}
                  </span>
                </div>
              );
            })}
          </div>

          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Active models
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Generation model", value: llmConfig.generation_model },
              { label: "Evaluation model", value: llmConfig.evaluation_model },
              { label: "Utterance model", value: llmConfig.utterance_model },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400">
          {!isAuthenticated
            ? "Sign in to view LLM config."
            : llmError
              ? "Fix the error above, then refresh the page."
              : "Loading…"}
        </p>
      )}
    </section>
  );
}
