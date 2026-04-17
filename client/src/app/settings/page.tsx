"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { InfoHint } from "@/components/ui/info-hint";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-1 min-h-0 h-full min-w-0 overflow-y-auto">
      <div className="max-w-lg mx-auto w-full p-6 sm:p-10 flex flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white m-0">Account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Password and sign-in</p>
        </header>

        {user ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-xs font-semibold text-gray-900 dark:text-white m-0">Signed in</p>
              {user.role !== "admin" ? (
                <InfoHint label="Account">
                  While signed in you can update your password anytime with your current password — no admin step.
                </InfoHint>
              ) : (
                <InfoHint label="Administrators">
                  Password changes for admin accounts use the Console (sidebar, below Runs) and require the admin secret code configured on the server.
                </InfoHint>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{user.email}</p>
            {user.role !== "admin" ? (
              <Link
                href="/change-password"
                className="inline-flex text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Change password
              </Link>
            ) : (
              <Link
                href="/console/change-password"
                className="inline-flex text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Change password in console
              </Link>
            )}
          </div>
        ) : null}

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Project generation and the Foundry library are in the{" "}
          <strong className="text-gray-500 dark:text-gray-400">Console</strong> for administrators (below Runs in the sidebar).
        </p>
      </div>
    </div>
  );
}
