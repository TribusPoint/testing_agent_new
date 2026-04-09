/**
 * Shared HTTP client, auth helpers, and base URL.
 * All endpoint modules import from here.
 */

function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!env) return "";
  if (!/^https?:\/\//i.test(env)) {
    return `https://${env.replace(/^\/+/, "")}`.replace(/\/+$/, "");
  }
  try {
    return new URL(env).origin;
  } catch {
    return env.replace(/\/+$/, "");
  }
}

export const BASE = apiBase();

const KEY_STORAGE = "ta_api_key";
const TOKEN_STORAGE = "ta_jwt_token";
const USER_STORAGE = "ta_user";

export function getStoredKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_STORAGE) ?? "";
}

export function setStoredKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key);
}

export function clearStoredKey() {
  localStorage.removeItem(KEY_STORAGE);
}

export function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_STORAGE) ?? "";
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE);
}

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser) {
  localStorage.setItem(USER_STORAGE, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_STORAGE);
}

export function clearAllAuth() {
  clearStoredKey();
  clearStoredToken();
  clearStoredUser();
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (token) return { Authorization: `Bearer ${token}` };
  const key = getStoredKey();
  if (key) return { "X-API-Key": key };
  return {};
}

export async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `Delete failed (${res.status})`);
  }
}

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
    ...init,
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const d = (body as { detail?: unknown }).detail;
    const msg =
      typeof d === "string"
        ? d
        : Array.isArray(d)
          ? d
              .map((x) => (typeof x === "object" && x !== null && "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x)))
              .join("; ")
          : "Request failed";
    throw new Error(msg || "Request failed");
  }
  return res.json() as T;
}
