"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useColorMode, type ColorMode } from "@/components/theme-provider";
import * as api from "@/lib/api";

const INPUT_CLS =
  "w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono";

const selectClass =
  "w-full text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900";

type Props = {
  collapsed: boolean;
};

export default function SidebarProfilePopover({ collapsed }: Props) {
  const { user, handleLogout } = useAuth();
  const { mode, setMode } = useColorMode();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const isApiKeySession = mounted && !!api.getStoredKey() && !user;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  const isJwtUser = !!user;
  const isAdmin = user?.role === "admin";

  const [keyDraft, setKeyDraft] = useState("");
  const [keyName, setKeyName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = api.getStoredKey();
    if (stored) {
      setKeyDraft(stored);
      const t = setTimeout(() => {
        void (async () => {
          setVerifying(true);
          try {
            const { name } = await api.verifyKey(stored);
            setKeyName(name);
            api.setStoredKey(stored);
          } catch {
            setKeyName(null);
          } finally {
            setVerifying(false);
          }
        })();
      }, 400);
      return () => clearTimeout(t);
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

  const showPopover = mounted && (!!user || isApiKeySession);

  if (!showPopover) return <div className="border-t border-gray-200 dark:border-gray-800 shrink-0" />;

  return (
    <div className="relative border-t border-gray-200 dark:border-gray-800 shrink-0" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          collapsed ? "flex-col justify-center" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            user ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
          }`}
        >
          {user ? user.name.charAt(0).toUpperCase() : "K"}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{user ? user.name : "API Key"}</p>
            <p className="text-[10px] text-gray-400 truncate">{user ? user.role : "key session"}</p>
          </div>
        )}
        {!collapsed && (
          <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className={`absolute bottom-full mb-1 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl max-h-[min(70vh,520px)] overflow-y-auto ${
            collapsed ? "left-0 right-0 w-56" : "left-0 right-0 w-full min-w-[260px]"
          }`}
          role="dialog"
          aria-label="Account menu"
        >
          <div className="p-3 flex flex-col gap-4">
            {isJwtUser && (
              <Link
                href="/change-password"
                onClick={close}
                className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline py-1"
              >
                Change password
              </Link>
            )}

            {!isJwtUser && (
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">API key</h3>
                <input
                  type="password"
                  className={INPUT_CLS}
                  placeholder="ta_…"
                  value={keyDraft}
                  onChange={(e) => {
                    setKeyDraft(e.target.value);
                    setKeyName(null);
                  }}
                />
                {keyName && (
                  <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">
                    OK — <span className="font-semibold">{keyName}</span>
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => verifyAndSet(keyDraft, true)}
                    disabled={verifying || !keyDraft}
                    className="flex-1 text-xs bg-indigo-600 text-white py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {verifying ? "…" : saved ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      api.clearStoredKey();
                      setKeyDraft("");
                      setKeyName(null);
                    }}
                    className="text-xs text-gray-500 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Clear
                  </button>
                </div>
              </section>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={close}
                className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline py-1"
              >
                Admin access
              </Link>
            )}

            <div>
              <label htmlFor="sidebar-appearance" className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                Appearance
              </label>
              <select
                id="sidebar-appearance"
                value={mode}
                onChange={(e) => setMode(e.target.value as ColorMode)}
                className={selectClass}
                aria-label="Appearance"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                close();
                handleLogout();
              }}
              className="flex items-center justify-center gap-2 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg py-2 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
