"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import * as api from "@/lib/api";

const INPUT =
  "w-full text-sm px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400";

export function ChangePasswordForm({
  title = "Change your password",
  description,
  currentPasswordLabel = "Current password",
  currentPasswordPlaceholder = "Enter your current password",
  redirectTo,
  showLogout = true,
  compact = false,
  backHref,
  backLabel,
  requireAdminSecret = false,
}: {
  title?: string;
  description?: string;
  currentPasswordLabel?: string;
  currentPasswordPlaceholder?: string;
  redirectTo: string;
  showLogout?: boolean;
  compact?: boolean;
  backHref?: string;
  backLabel?: string;
  requireAdminSecret?: boolean;
}) {
  const router = useRouter();
  const { clearMustChangePassword, handleLogout } = useAuth();
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPw !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    if (newPw.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (requireAdminSecret && !adminSecret.trim()) {
      setError("Admin secret code is required.");
      return;
    }
    setLoading(true);
    try {
      await api.changeMyPassword(curPw, newPw, requireAdminSecret ? adminSecret.trim() : undefined);
      clearMustChangePassword();
      router.replace(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setLoading(false);
    }
  }

  const inner = (
    <div className={compact ? "" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-8"}>
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline mb-4"
        >
          ← {backLabel ?? "Back"}
        </Link>
      ) : null}
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{title}</h1>
      {description ? <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{description}</p> : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{currentPasswordLabel}</label>
          <input
            type="password"
            className={INPUT}
            placeholder={currentPasswordPlaceholder}
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">New password</label>
          <input
            type="password"
            className={INPUT}
            placeholder="Min 4 characters"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={4}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Confirm new password</label>
          <input
            type="password"
            className={INPUT}
            placeholder="Re-type your new password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
          />
        </div>
        {requireAdminSecret ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Admin secret code</label>
            <input
              type="password"
              className={INPUT}
              placeholder="Same value as ADMIN_PASSWORD_SECRET_CODE on the server"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Required for administrator password changes. Not your account password.
            </p>
          </div>
        ) : null}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || !curPw || !newPw || !confirmPw || (requireAdminSecret && !adminSecret.trim())}
          className="w-full text-sm font-medium bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Changing…" : "Update password"}
        </button>
      </form>

      {showLogout ? (
        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Log out instead
        </button>
      ) : null}
    </div>
  );

  if (compact) {
    return <div className="max-w-md">{inner}</div>;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="w-full max-w-md">{inner}</div>
    </div>
  );
}
