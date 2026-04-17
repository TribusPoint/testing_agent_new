"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { StatusPing, statusPingTriggerBase } from "@/components/ui/status-ping";

export type InfoHintProps = {
  children: ReactNode;
  /** Accessible name for the control */
  label?: string;
  className?: string;
  /** Extra classes on the trigger (hit area + focus). Ping colors come from `pingTone`. */
  buttonClassName?: string;
  /**
   * Blinking status light, same pattern as the dashboard “Work in progress” pill (amber).
   * Default violet matches app chrome; use `amber` where the surrounding UI is amber (e.g. Foundry).
   */
  pingTone?: "violet" | "amber";
  /** Outer wrapper classes for `StatusPing` (e.g. larger pulse on marketing layouts). */
  pingClassName?: string;
  /** Inner dot size classes passed to `StatusPing` (e.g. `h-5 w-5`). */
  pingSize?: string;
};

/**
 * Help control: hover or click opens copy in a portal so parent overflow (e.g. app shell main) cannot clip it.
 * Click toggles pinned open; Escape or click outside closes.
 */
export function InfoHint({
  children,
  label = "About this section",
  className = "",
  buttonClassName = "",
  pingTone = "violet",
  pingClassName,
  pingSize,
}: InfoHintProps) {
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const open = pinned || hovered;
  const close = useCallback(() => {
    setPinned(false);
    setHovered(false);
  }, []);

  const cancelCloseTimer = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const armCloseHover = useCallback(() => {
    cancelCloseTimer();
    if (pinned) return;
    leaveTimer.current = setTimeout(() => setHovered(false), 280);
  }, [pinned, cancelCloseTimer]);

  useLayoutEffect(() => {
    if (!open || !mounted) return;

    const place = () => {
      const btn = btnRef.current;
      const panel = panelRef.current;
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 10;
      const gap = 8;
      const maxW = Math.min(22 * 16, vw - margin * 2);
      const w = maxW;

      let left = rect.left + rect.width / 2 - w / 2;
      left = Math.max(margin, Math.min(left, vw - w - margin));

      const ph = panel?.offsetHeight ?? 120;
      let top = rect.bottom + gap;
      const spaceBelow = vh - rect.bottom - gap - margin;
      const spaceAbove = rect.top - gap - margin;
      if (ph > spaceBelow && spaceAbove > spaceBelow) {
        top = rect.top - gap - ph;
        top = Math.max(margin, top);
      } else if (top + ph > vh - margin) {
        top = Math.max(margin, vh - ph - margin);
      }

      setPanelStyle({
        position: "fixed",
        left,
        top,
        width: w,
        zIndex: 9999,
        maxHeight: "min(70vh, 24rem)",
      });
    };

    place();
    const ro = panelRef.current ? new ResizeObserver(place) : null;
    if (panelRef.current) ro!.observe(panelRef.current);

    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, mounted, children]);

  useEffect(() => {
    if (!pinned) return;
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    let raf = 0;
    raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", onDoc);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [pinned, close]);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned, close]);

  const portal =
    mounted &&
    open &&
    createPortal(
      <div
        ref={panelRef}
        id={panelId}
        role="tooltip"
        style={panelStyle}
        className="overflow-y-auto rounded-xl border border-gray-200/95 bg-white/98 px-3.5 py-3 text-left text-xs leading-relaxed text-gray-700 shadow-2xl shadow-indigo-950/10 ring-1 ring-black/5 backdrop-blur-sm dark:border-gray-600 dark:bg-gray-900/98 dark:text-gray-100 dark:ring-white/10"
        onMouseEnter={cancelCloseTimer}
        onMouseLeave={armCloseHover}
      >
        {children}
      </div>,
      document.body,
    );

  return (
    <span className={`relative inline-flex shrink-0 align-middle ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className={`${statusPingTriggerBase(pingTone)}${buttonClassName ? ` ${buttonClassName}` : ""}`}
        aria-label={label}
        aria-expanded={pinned}
        aria-controls={panelId}
        onClick={() => setPinned((p) => !p)}
        onMouseEnter={() => {
          cancelCloseTimer();
          setHovered(true);
        }}
        onMouseLeave={armCloseHover}
        onFocus={() => {
          cancelCloseTimer();
          setHovered(true);
        }}
        onBlur={() => {
          if (!pinned) armCloseHover();
        }}
      >
        <StatusPing tone={pingTone} className={pingClassName} size={pingSize} />
      </button>
      {portal}
    </span>
  );
}
