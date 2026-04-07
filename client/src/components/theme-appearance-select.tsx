"use client";

import { useColorMode, type ColorMode } from "./theme-provider";

const selectClass =
  "w-full text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900";

export default function ThemeAppearanceSelect({ collapsed }: { collapsed: boolean }) {
  const { mode, setMode } = useColorMode();

  if (collapsed) {
    return (
      <div className="px-2 pb-2 shrink-0">
        <label className="sr-only" htmlFor="theme-mode-collapsed">
          Appearance
        </label>
        <select
          id="theme-mode-collapsed"
          value={mode}
          onChange={(e) => setMode(e.target.value as ColorMode)}
          className={selectClass}
          title="Appearance"
          aria-label="Appearance: light, dark, or system"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 shrink-0">
      <label htmlFor="theme-mode" className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
        Appearance
      </label>
      <select
        id="theme-mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as ColorMode)}
        className={selectClass}
        aria-label="Appearance"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System (default)</option>
      </select>
    </div>
  );
}
