"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import SidebarProfilePopover from "@/components/sidebar-profile-popover";

const STORAGE_KEY = "testing-agent-console-sidebar-collapsed";

const iconClass = "w-5 h-5 shrink-0";

function IconOverview({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function IconKnowledgeBase({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
      />
    </svg>
  );
}

function IconProject({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
      />
    </svg>
  );
}

/** Main app entry — distinct from Overview (grid) icon */
function IconHomeApp({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

const NAV: { href: string; label: string; Icon: (p: { className?: string }) => React.JSX.Element }[] = [
  { href: "/console", label: "Overview", Icon: IconOverview },
  { href: "/console/content", label: "Foundry", Icon: IconUpload },
  { href: "/console/knowledge-base", label: "Knowledge base", Icon: IconKnowledgeBase },
];

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const navItem = (active: boolean) =>
    `flex items-center rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
      collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
    } ${
      active
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
    }`;

  const brandFocus =
    "rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900";

  return (
    <div className="flex flex-1 min-h-0 w-full">
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
            href="/console"
            className={`${brandFocus} ${collapsed ? "flex flex-col items-center text-center px-0.5 py-0.5 w-full" : "inline-block min-w-0"}`}
            aria-label="Console home"
          >
            {collapsed ? (
              <span className="text-xs font-black tracking-[-0.04em] leading-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Console
              </span>
            ) : (
              <>
                <span className="text-2xl font-black tracking-[-0.04em] whitespace-nowrap leading-none bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Console
                </span>
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-1 tracking-wide">Admin workspace</p>
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={toggle}
            className={`shrink-0 p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
              collapsed ? "w-full" : ""
            }`}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand console sidebar" : "Collapse console sidebar"}
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

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-0.5 min-h-0 border-t border-gray-100 dark:border-gray-800/80">
          {NAV.map(({ href, label, Icon }) => {
            const active =
              href === "/console"
                ? pathname === "/console" ||
                  pathname.startsWith("/console/project-repo") ||
                  pathname.startsWith("/console/llm")
                : pathname === href || pathname.startsWith(href);
            return (
              <Link key={href} href={href} title={collapsed ? label : undefined} aria-label={label} className={navItem(active)}>
                <Icon />
                {!collapsed ? <span className="truncate">{label}</span> : null}
              </Link>
            );
          })}
          <div className="mx-2 my-2 border-t border-gray-200 dark:border-gray-700" aria-hidden />
          <Link
            href="/dashboard"
            title={collapsed ? "Testing Agent app" : undefined}
            aria-label="Return to Testing Agent app"
            className={navItem(false)}
          >
            <IconHomeApp />
            {!collapsed ? <span className="truncate">Testing Agent app</span> : null}
          </Link>
        </nav>

        <SidebarProfilePopover collapsed={collapsed} surface="console" />
      </aside>
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden w-full min-w-0 bg-gray-50 dark:bg-gray-950">{children}</main>
    </div>
  );
}
