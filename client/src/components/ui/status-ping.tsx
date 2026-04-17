export type StatusPingTone = "violet" | "amber" | "green" | "red";

const PALETTE: Record<StatusPingTone, { ping: string; dot: string }> = {
  /** Matches dashboard / runs “Work in progress” pill (plain dot, no glow). */
  amber: {
    ping: "bg-amber-400",
    dot: "bg-amber-500",
  },
  violet: {
    ping: "bg-violet-400 dark:bg-violet-400",
    dot:
      "bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.45)] dark:bg-violet-400 dark:shadow-[0_0_12px_rgba(167,139,250,0.5)]",
  },
  green: {
    ping: "bg-green-400 dark:bg-green-400",
    dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] dark:bg-green-400 dark:shadow-[0_0_10px_rgba(74,222,128,0.45)]",
  },
  red: {
    ping: "bg-red-400 dark:bg-red-400",
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] dark:bg-red-400 dark:shadow-[0_0_10px_rgba(248,113,113,0.45)]",
  },
};

export type StatusPingProps = {
  tone: StatusPingTone;
  /** Outer wrapper; default matches info-hint / dashboard density */
  className?: string;
  /** Dot diameter (Tailwind scale), e.g. `h-2 w-2` for compact pills */
  size?: string;
};

/**
 * Dual-layer + `animate-ping` status light (same pattern as dashboard “Work in progress”).
 */
export function StatusPing({
  tone,
  className = "relative flex h-2.5 w-2.5 shrink-0 items-center justify-center",
  size = "h-2.5 w-2.5",
}: StatusPingProps) {
  const { ping, dot } = PALETTE[tone];
  return (
    <span className={className} aria-hidden>
      <span className={`pointer-events-none absolute inset-0 inline-flex animate-ping rounded-full opacity-75 ${ping}`} />
      <span className={`relative z-[1] inline-flex ${size} shrink-0 rounded-full ${dot}`} />
    </span>
  );
}

export function statusPingTriggerRing(tone: "violet" | "amber"): string {
  return tone === "amber"
    ? "focus-visible:ring-amber-500/55 dark:focus-visible:ring-amber-400/50"
    : "focus-visible:ring-violet-500/65 dark:focus-visible:ring-violet-400/55";
}

export function statusPingTriggerHover(tone: "violet" | "amber"): string {
  return tone === "amber"
    ? "hover:bg-amber-500/10 dark:hover:bg-amber-400/10"
    : "hover:bg-violet-500/10 dark:hover:bg-violet-400/10";
}

/** Default hit area + focus ring classes for ping-as-button triggers (see `InfoHint`). */
export function statusPingTriggerBase(tone: "violet" | "amber"): string {
  return (
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-transparent " +
    "bg-transparent transition-colors " +
    `${statusPingTriggerHover(tone)} focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 ${statusPingTriggerRing(tone)}`
  );
}
