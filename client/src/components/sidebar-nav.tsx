"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import SidebarProfilePopover from "@/components/sidebar-profile-popover";

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

function IconConsole({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
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

function IconCompany({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 21h19.5M3.75 21V9.75m16.5 11.25V9.75M3.75 21h4.5m12 0h4.5M3.75 9.75h4.5m12 0h4.5M9 21V9.75m6 11.25V9.75M9 9.75h6M9 6.75h6m-6 3h6M5.25 9.75v-3h3v3m7.5 0v-3h3v3"
      />
    </svg>
  );
}

type NavLink = { href: string; label: string; Icon: (p: { className?: string }) => React.JSX.Element };

const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/connections", label: "Connections", Icon: IconConnections },
  { href: "/runs", label: "Runs", Icon: IconRuns },
  { href: "/my-company", label: "My Company", Icon: IconCompany },
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
  const { user } = useAuth();
  const isAdminJwt = user?.role === "admin";

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

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-0.5" aria-label="Main navigation">
        {LINKS.map(({ href, label, Icon }) => {
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
        {isAdminJwt ? (
          <>
            <div
              className="mx-2 mt-1 border-b border-gray-300 dark:border-gray-600"
              aria-hidden
            />
            <Link
              href="/console"
              title={collapsed ? "Console" : undefined}
              aria-label="Console"
              className={`mt-1 flex items-center rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                pathname.startsWith("/console")
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
              }`}
            >
              <IconConsole />
              {!collapsed ? <span className="truncate">Console</span> : null}
            </Link>
          </>
        ) : null}
      </nav>
      <SidebarProfilePopover collapsed={collapsed} surface="app" />
    </aside>
  );
}
