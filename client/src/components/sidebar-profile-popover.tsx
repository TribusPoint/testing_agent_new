"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth-provider";
import { useColorMode, type ColorMode } from "@/components/theme-provider";

const THEME_CYCLE: ColorMode[] = ["system", "dark", "light"];

function nextColorMode(mode: ColorMode): ColorMode {
  const i = THEME_CYCLE.indexOf(mode);
  const idx = i === -1 ? 0 : (i + 1) % THEME_CYCLE.length;
  return THEME_CYCLE[idx];
}

function roleLabel(role: string): "Admin" | "Member" {
  return role.toLowerCase() === "admin" ? "Admin" : "Member";
}

function IconMonitor({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12h19.5m-19.5 3.75h19.5m-19.5-7.5h19.5M3.375 19.5h17.25c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function ThemeModeIcon({ mode }: { mode: ColorMode }) {
  if (mode === "dark") return <IconMoon className="shrink-0" />;
  if (mode === "light") return <IconSun className="shrink-0" />;
  return <IconMonitor className="shrink-0" />;
}

function modeDescription(mode: ColorMode): string {
  if (mode === "system") return "System";
  if (mode === "dark") return "Dark";
  return "Light";
}

type TipKind = "theme" | "logout";

const MENU_GAP = 8;
const MENU_Z = 10060;

function AccountMenuDropdownPortal({
  anchorEl,
  open,
  onClose,
  children,
}: {
  anchorEl: HTMLElement;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [box, setBox] = useState(() => anchorEl.getBoundingClientRect());
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => setBox(anchorEl.getBoundingClientRect());
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorEl, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorEl.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose, anchorEl]);

  if (!open || typeof document === "undefined") return null;

  const w = Math.max(200, box.width);
  let left = box.left;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label="Account menu"
      style={{
        position: "fixed",
        left,
        top: box.top - MENU_GAP,
        transform: "translateY(-100%)",
        width: w,
        zIndex: MENU_Z,
      }}
      className="rounded-lg border border-gray-200 bg-white py-2.5 px-3 shadow-xl ring-1 ring-black/5 dark:border-gray-600 dark:bg-gray-800 dark:ring-white/10"
    >
      {children}
    </div>,
    document.body,
  );
}

const TIP_GAP = 8;
const TIP_Z = 10050;

function tipPanelClass(multiline: boolean): string {
  return (
    "pointer-events-none rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-900 shadow-lg ring-1 ring-black/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:ring-white/10 " +
    (multiline ? "max-w-[min(14rem,calc(100vw-1rem))] text-left leading-snug" : "whitespace-nowrap text-center")
  );
}

function ProfileHoverTipPortal({
  anchorEl,
  children,
  multiline,
}: {
  anchorEl: HTMLElement;
  children: ReactNode;
  multiline: boolean;
}) {
  const [box, setBox] = useState(() => anchorEl.getBoundingClientRect());

  useLayoutEffect(() => {
    const place = () => setBox(anchorEl.getBoundingClientRect());
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorEl]);

  const cx = box.left + box.width / 2;
  const margin = 6;
  const spaceAbove = box.top;
  const placeBelow = spaceAbove < 40;
  const top = placeBelow ? box.bottom + TIP_GAP : box.top - TIP_GAP;
  const transform = placeBelow ? "translateX(-50%)" : "translate(-50%, -100%)";

  let left = cx;
  const halfGuess = multiline ? 112 : 100;
  left = Math.max(margin + halfGuess, Math.min(left, window.innerWidth - margin - halfGuess));

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left,
        top,
        transform,
        zIndex: TIP_Z,
      }}
      className={tipPanelClass(multiline)}
    >
      {children}
    </div>,
    document.body,
  );
}

type Props = {
  collapsed: boolean;
  /** Main Testing Agent sidebar vs Platform console (affects account menu links). */
  surface?: "app" | "console";
};

export default function SidebarProfilePopover({ collapsed, surface = "app" }: Props) {
  const { user, handleLogout } = useAuth();
  const { mode, setMode } = useColorMode();
  const [mounted, setMounted] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const titleId = useId();

  const [hoverTip, setHoverTip] = useState<{ kind: TipKind; el: HTMLElement } | null>(null);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<HTMLElement | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const showTip = useCallback(
    (kind: TipKind, el: HTMLElement) => {
      cancelLeave();
      setHoverTip({ kind, el });
    },
    [cancelLeave],
  );

  const hideTipSoon = useCallback(() => {
    cancelLeave();
    leaveTimer.current = setTimeout(() => setHoverTip(null), 80);
  }, [cancelLeave]);

  useEffect(() => setMounted(true), []);
  useEffect(() => () => cancelLeave(), [cancelLeave]);

  const closeLogout = useCallback(() => setLogoutOpen(false), []);

  const closeAccountMenu = useCallback(() => setAccountMenuAnchor(null), []);

  const toggleAccountMenu = useCallback(
    (el: HTMLElement) => {
      cancelLeave();
      setHoverTip(null);
      setAccountMenuAnchor((prev) => (prev === el ? null : el));
    },
    [cancelLeave],
  );

  useEffect(() => {
    if (!logoutOpen) return;
    setHoverTip(null);
    closeAccountMenu();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLogout();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [logoutOpen, closeLogout, closeAccountMenu]);

  const cycleTheme = useCallback(() => {
    setMode(nextColorMode(mode));
  }, [mode, setMode]);

  const confirmLogout = useCallback(() => {
    closeLogout();
    handleLogout();
  }, [closeLogout, handleLogout]);

  if (!mounted || !user) return <div className="border-t border-gray-200 dark:border-gray-800 shrink-0" />;

  const next = nextColorMode(mode);
  const themeAria = `Appearance: ${modeDescription(mode)}. Activate to switch to ${modeDescription(next)}.`;
  const themePurpose = "Switch theme: System, Dark, or Light";
  const logoutPurpose = "Sign out of your account";

  const circleSm = "h-8 w-8 shrink-0 rounded-full";
  const circleMd = "h-9 w-9 shrink-0 rounded-full";
  const avatarCircle = collapsed ? circleSm : circleMd;
  const actionCircle = collapsed ? circleSm : circleMd;

  const iconBtnBase =
    "inline-flex items-center justify-center border text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 transition-colors";

  const isAdmin = user.role.toLowerCase() === "admin";
  const roleBadgeClass = isAdmin
    ? "border border-indigo-200/90 bg-indigo-50/90 text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-950/55 dark:text-indigo-100"
    : "border border-gray-200/95 bg-white/90 text-gray-800 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-100";

  const logoutIcon = (
    <svg className="w-[17px] h-[17px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12h9m0 0l-3-3m3 3l-3 3" />
    </svg>
  );

  const tipPortal =
    hoverTip && typeof document !== "undefined" ? (
      <ProfileHoverTipPortal anchorEl={hoverTip.el} multiline={false}>
        {hoverTip.kind === "theme" ? themePurpose : logoutPurpose}
      </ProfileHoverTipPortal>
    ) : null;

  const menuLinkClass =
    "block w-full rounded-md px-2 py-2 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

  const accountMenuPortal =
    accountMenuAnchor ? (
      <AccountMenuDropdownPortal anchorEl={accountMenuAnchor} open onClose={closeAccountMenu}>
        <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user.name}</div>
        {user.email && user.email !== user.name ? (
          <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 truncate mb-3">{user.email}</div>
        ) : (
          <div className="mb-2" />
        )}
        {surface === "app" && !isAdmin ? (
          <Link href="/change-password" className={menuLinkClass} role="menuitem" onClick={closeAccountMenu}>
            Change password
          </Link>
        ) : null}
        {surface === "app" && isAdmin ? (
          <>
            <p className="text-[10px] leading-snug text-gray-600 dark:text-gray-400 mb-2">
              Password changes for administrators use the Console (sidebar, below Runs) and the admin secret code.
            </p>
            <Link href="/console/change-password" className={menuLinkClass} role="menuitem" onClick={closeAccountMenu}>
              Open change password in console
            </Link>
          </>
        ) : null}
        {surface === "console" ? (
          <Link href="/console/change-password" className={menuLinkClass} role="menuitem" onClick={closeAccountMenu}>
            Change password
          </Link>
        ) : null}
      </AccountMenuDropdownPortal>
    ) : null;

  return (
    <div className="relative border-t border-gray-200 dark:border-gray-800 shrink-0 p-2">
      {tipPortal}
      {accountMenuPortal}

      <div className="flex w-full min-w-0 flex-row items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-row items-center gap-2">
          <button
            type="button"
            className={`${avatarCircle} shrink-0 flex items-center justify-center text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 outline-none ring-offset-2 ring-offset-white dark:ring-offset-gray-900 focus-visible:ring-2 focus-visible:ring-indigo-500`}
            aria-label={`Account menu. ${user.name}${user.email && user.email !== user.name ? `. ${user.email}` : ""}`}
            aria-expanded={Boolean(accountMenuAnchor)}
            aria-haspopup="menu"
            onClick={(e) => toggleAccountMenu(e.currentTarget)}
          >
            {user.name.charAt(0).toUpperCase()}
          </button>
          <span
            className={`inline-flex min-w-0 max-w-full shrink-0 items-center truncate rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleBadgeClass}`}
          >
            {roleLabel(user.role)}
          </span>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-2">
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={themeAria}
            className={`${iconBtnBase} ${actionCircle}`}
            onMouseEnter={(e) => showTip("theme", e.currentTarget)}
            onMouseLeave={hideTipSoon}
            onFocus={(e) => showTip("theme", e.currentTarget)}
            onBlur={hideTipSoon}
          >
            <ThemeModeIcon mode={mode} />
          </button>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            aria-label={logoutPurpose}
            className={`${iconBtnBase} ${actionCircle} border-gray-200 dark:border-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:border-red-400 focus-visible:bg-red-50 focus-visible:text-red-700 dark:hover:border-red-800 dark:hover:bg-red-950/35 dark:hover:text-red-300 dark:focus-visible:border-red-700 dark:focus-visible:bg-red-950/40 dark:focus-visible:text-red-200`}
            onMouseEnter={(e) => showTip("logout", e.currentTarget)}
            onMouseLeave={hideTipSoon}
            onFocus={(e) => showTip("logout", e.currentTarget)}
            onBlur={hideTipSoon}
          >
            {logoutIcon}
          </button>
        </div>
      </div>

      {logoutOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeLogout();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
          >
            <h2 id={titleId} className="text-sm font-semibold text-gray-900 dark:text-white">
              Sign out?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              You will need to sign in again to access your workspace.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeLogout}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
