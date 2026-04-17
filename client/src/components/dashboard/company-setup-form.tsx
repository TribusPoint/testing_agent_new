"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import * as api from "@/lib/api";

const INDUSTRIES = [
  { value: "university", label: "University" },
  { value: "healthcare", label: "Healthcare" },
  { value: "banking", label: "Banking" },
] as const;

const INPUT =
  "w-full text-sm py-2.5 px-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/95 dark:bg-gray-800/95 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70";

type Mode = "onboarding" | "edit";

export function CompanySetupForm({
  mode,
  initialCompanyName = "",
  initialUrl = "",
  initialIndustry = "university",
}: {
  mode: Mode;
  initialCompanyName?: string;
  initialUrl?: string;
  initialIndustry?: string;
}) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [url, setUrl] = useState(initialUrl);
  const [industry, setIndustry] = useState(initialIndustry);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setCompanyName(initialCompanyName);
    setUrl(initialUrl);
    setIndustry(initialIndustry);
  }, [initialCompanyName, initialUrl, initialIndustry]);

  const title = mode === "onboarding" ? "Company setup" : "Update company profile";
  const submitLabel = mode === "onboarding" ? "Save and continue" : "Submit update request";

  const runSubmit = useCallback(async () => {
    setError("");
    const u = url.trim();
    if (!u.toLowerCase().startsWith("https://")) {
      setError("Website URL must start with https://");
      return;
    }
    setLoading(true);
    try {
      if (mode === "onboarding") {
        await api.completeMemberOnboarding({
          company_name: companyName.trim(),
          company_url: u,
          industry,
        });
      } else {
        await api.submitMemberCompanyEdit({
          company_name: companyName.trim(),
          company_url: u,
          industry,
        });
      }
      await refreshUser();
      if (mode === "onboarding") {
        router.replace("/my-company");
      } else {
        router.replace("/dashboard");
      }
      setShowConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [companyName, url, industry, mode, refreshUser, router]);

  return (
    <div className="w-full max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {mode === "onboarding"
            ? "Enter your organization details. We’ll verify your website is reachable before continuing."
            : "Submit changes for administrator approval. Your current profile stays active until approved."}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company name</label>
          <input
            className={INPUT}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme University"
            autoComplete="organization"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Website URL</label>
          <input
            className={`${INPUT} font-mono text-xs`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.edu"
            autoComplete="url"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Industry</label>
          <select
            className={INPUT}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            {INDUSTRIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={loading || !companyName.trim()}
        onClick={() => setShowConfirm(true)}
        className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitLabel}
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {mode === "onboarding"
                ? "We’ll check that your website responds over HTTPS, then save your profile and generate a site overview."
                : "We’ll verify the URL and send this update to an administrator for approval."}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                onClick={() => void runSubmit()}
                disabled={loading}
              >
                {loading ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
