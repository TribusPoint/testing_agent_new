"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ColorMode = "light" | "dark" | "system";

export const COLOR_MODE_STORAGE_KEY = "testing-agent-color-mode";

function getStoredMode(): ColorMode {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyColorModeToDocument(mode: ColorMode) {
  const resolved = resolveColorMode(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

type ThemeContextValue = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  resolved: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(getStoredMode);
  const [systemPref, setSystemPref] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );

  const resolved: "light" | "dark" = mode === "system" ? systemPref : mode;

  useEffect(() => {
    applyColorModeToDocument(mode);
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }

    if (mode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setSystemPref(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ColorMode) => {
    setModeState(next);
  }, []);

  const value = useMemo(() => ({ mode, setMode, resolved }), [mode, setMode, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useColorMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useColorMode must be used within ThemeProvider");
  }
  return ctx;
}
