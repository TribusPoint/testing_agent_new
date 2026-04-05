"use client";
import { useState, useEffect, useCallback } from "react";

/**
 * A hook that persists state in sessionStorage so it survives page navigation.
 * State is automatically synced to sessionStorage on change.
 * 
 * @param key - Unique key for sessionStorage
 * @param initialValue - Default value if nothing is stored
 */
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Initialize state from sessionStorage or use initialValue
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = sessionStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Sync to sessionStorage whenever state changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  }, [key, state]);

  // Clear function to remove from storage
  const clear = useCallback(() => {
    setState(initialValue);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(key);
    }
  }, [key, initialValue]);

  return [state, setState, clear];
}

/**
 * Persists form field values as an object.
 * Useful for preserving unsaved form data.
 */
export function usePersistedForm<T extends Record<string, unknown>>(
  key: string,
  initialValues: T
): {
  values: T;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (values: T | ((prev: T) => T)) => void;
  reset: () => void;
} {
  const [values, setValues, clear] = usePersistedState<T>(key, initialValues);

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, [setValues]);

  return { values, setValue, setValues, reset: clear };
}
