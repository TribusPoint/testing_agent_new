"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ThemeAppearanceSelect from "@/components/theme-appearance-select";
import { useAuth } from "@/components/auth-provider";
import { getStoredKey } from "@/lib/api";

const STORAGE_KEY = "testing-agent-sidebar-collapsed";

const iconClass = "w-5 h-5 shrink-0";

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function IconConnections({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function IconProjects({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function IconRuns({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconRepo({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function IconAdmin({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

type NavLink = { href: string; label: string; Icon: (p: { className?: string }) => React.JSX.Element; adminOnly?: boolean };

const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/connections", label: "Connections", Icon: IconConnections },
  { href: "/projects", label: "Projects", Icon: IconProjects },
  { href: "/runs", label: "Runs", Icon: IconRuns },
  { href: "/questions-repo", label: "Questions Repo", Icon: IconRepo },
  { href: "/admin", label: "Admin Access", Icon: IconAdmin, adminOnly: true },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function SidebarNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const { user, handleLogout } = useAuth();
  const isApiKeySession = typeof window !== "undefined" && !!getStoredKey() && !user;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const brandFocus =
    "rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900";

  return (
    <aside
      className={`shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-0 overflow-hidden transition-[width] duration-200 ease-out ${
        collapsed ? "w-[5.25rem]" : "w-56"
      }`}
    >
      <div
        className={`border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2 ${
          collapsed ? "flex-col justify-center py-2.5 px-1.5 gap-2" : "justify-between px-3 py-3 min-h-[3.25rem]"
        }`}
      >
        <Link
          href="/dashboard"
          className={`${brandFocus} ${collapsed ? "flex flex-col items-center text-center px-0.5 py-0.5 w-full" : "min-w-0"}`}
          aria-label="Testing Agent home"
        >
          {collapsed ? (
            <>
              <span className="text-[10px] font-black tracking-[-0.06em] leading-tight text-gray-900 dark:text-white">Testing</span>
              <span className="text-[10px] font-black tracking-[-0.06em] leading-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Agent
              </span>
            </>
          ) : (
            <span className="text-2xl font-black tracking-[-0.04em] whitespace-nowrap">
              <span className="text-gray-900 dark:text-white">Testing </span>
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Agent</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          className={`shrink-0 p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
            collapsed ? "w-full" : ""
          }`}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-0.5">
        {LINKS.filter((l) => !l.adminOnly || user?.role === "admin").map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
              }`}
            >
              <Icon />
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <ThemeAppearanceSelect collapsed={collapsed} />
      {(user || isApiKeySession) && (
        <div
          className={`border-t border-gray-200 dark:border-gray-800 shrink-0 p-2 ${
            collapsed ? "flex flex-col items-center gap-1" : "flex items-center gap-2"
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              user
                ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}
            title={user ? user.name : "API Key"}
          >
            {user ? user.name.charAt(0).toUpperCase() : "K"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{user ? user.name : "API Key"}</p>
              <p className="text-[10px] text-gray-400 truncate">{user ? user.role : "key session"}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className={`p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              collapsed ? "" : "ml-auto shrink-0"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
