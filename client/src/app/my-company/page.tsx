"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPing } from "@/components/ui/status-ping";
import { MemberCompanyAnalysisView } from "@/components/member-company-analysis-view";
import { useAuth } from "@/components/auth-provider";
import * as api from "@/lib/api";

export default function MyCompanyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<api.MemberCompanyProfile | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const p = await api.getMemberCompanyProfile();
      setProfile(p);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load profile");
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user || user.role !== "member") return;
    if (user.needs_company_onboarding || user.pending_company_edit) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (user?.role === "member" && (user.needs_company_onboarding || user.pending_company_edit)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-500 dark:text-gray-400">
        Redirecting…
      </div>
    );
  }

  if (profile === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    );
  }

  if (!profile || !profile.onboarding_completed_at) {
    return (
      <div className="relative flex-1 min-h-0 overflow-auto p-6 sm:p-10">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 text-center">
          <p className="text-gray-700 dark:text-gray-300">
            Complete company setup on the Dashboard to see your organization overview here.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 h-full overflow-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-100/80 dark:from-gray-950 dark:via-indigo-950/30 dark:to-violet-950/40"
      />
      <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-4 dark:border-emerald-500/25 dark:bg-emerald-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                Organization
              </p>
              <h1 className="truncate text-xl font-bold text-gray-900 dark:text-white">{profile.company_name}</h1>
              <p className="truncate text-sm text-gray-600 dark:text-gray-400">
                <span className="font-mono text-xs">{profile.company_url}</span>
                <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                <span className="capitalize">{profile.industry}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:border-emerald-500/40 dark:bg-gray-900/60 dark:text-emerald-200">
                <StatusPing tone="green" className="relative flex h-2.5 w-2.5 shrink-0" size="h-2.5 w-2.5" />
                Active
              </span>
              <button
                type="button"
                onClick={() => router.push("/dashboard?editCompany=1")}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                Edit profile
              </button>
            </div>
          </div>
        </div>

        {loadError ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{loadError}</p> : null}

        {profile.site_analysis ? (
          <MemberCompanyAnalysisView
            displayName={profile.company_name}
            analysis={profile.site_analysis}
            analyzedAt={profile.site_analyzed_at ?? null}
          />
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-6 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
            Site overview isn’t available yet (analysis didn’t complete or failed). You can try updating your company
            profile after an administrator helps verify API keys.
          </div>
        )}
      </div>
    </div>
  );
}
