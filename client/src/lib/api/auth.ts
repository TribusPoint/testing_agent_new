import { BASE, del, req } from "./client";
import type { AuthResponse, UserInfo, MessageResponse, PasswordResetInfo } from "./types";

function formatAuthError(r: Response, body: unknown, fallback: string): string {
  if (r.status === 404) {
    return `API not found (404). The app is calling ${BASE} — start the Python API there, or set NEXT_PUBLIC_API_URL in client/.env.local to your API URL.`;
  }
  const d = body as { detail?: unknown };
  const detail = d?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((x) => (typeof x === "object" && x !== null && "msg" in x ? String((x as { msg: string }).msg) : JSON.stringify(x)))
      .join("; ");
  }
  return fallback;
}

async function parseBody(r: Response): Promise<unknown> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { detail: r.status === 404 ? "Not Found" : text.slice(0, 200) };
  }
}

function networkErrorHint(): string {
  if (!BASE) {
    return (
      "Start the API (e.g. uvicorn) on the host/port Next proxies to — default API_INTERNAL_URL is http://127.0.0.1:8080 " +
      "(see client/next.config.ts). Or set NEXT_PUBLIC_API_URL in client/.env.local to the API base URL and restart pnpm dev. " +
      "If login still hangs, ensure PostgreSQL is running and DATABASE_URL in server/.env is correct."
    );
  }
  const origin = BASE.replace(/\/$/, "");
  return (
    `No HTTP response from ${BASE} in time. From the server folder, after pip install -r requirements.txt, run ` +
    `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8080. Then open ${origin}/health in the browser; ` +
    `it should return JSON. If that URL never loads, another process may be using the port — use a different port ` +
    `and set NEXT_PUBLIC_API_URL to match. If /health works but sign-in still times out, check PostgreSQL and DATABASE_URL.`
  );
}

const AUTH_FETCH_TIMEOUT_MS = 25_000;

async function authFetch<T>(url: string, init: RequestInit, fallbackMsg: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AUTH_FETCH_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        `Sign-in request timed out after ${AUTH_FETCH_TIMEOUT_MS / 1000}s. ${networkErrorHint()}`,
      );
    }
    const msg = e instanceof Error ? e.message : "Network error";
    throw new Error(`${msg}. ${networkErrorHint()}`);
  }
  clearTimeout(timer);
  const body = await parseBody(r);
  if (!r.ok) throw new Error(formatAuthError(r, body, fallbackMsg));
  return body as T;
}

// --- Legacy admin-only endpoint. Prefer `login("admin", password)` or `login("admin@admin.com", password)`. ---
export const adminLogin = (username: string, password: string) =>
  authFetch<AuthResponse>(`${BASE}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }, "Admin login failed");

// --- Email/password login ---
export const login = (email: string, password: string) =>
  authFetch<AuthResponse>(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, "Login failed");

// --- Self-registration (returns message, not token) ---
export const register = (email: string, password: string, name: string) =>
  authFetch<MessageResponse>(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  }, "Registration failed");

// --- Forgot password (public) ---
export const forgotPassword = (email: string) =>
  authFetch<MessageResponse>(`${BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }, "Request failed");

// --- Change own password (authenticated) ---
export const changeMyPassword = (currentPassword: string, newPassword: string, secret?: string) =>
  req<MessageResponse>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      ...(secret != null && secret !== "" ? { secret } : {}),
    }),
  });

// --- Current user ---
export const getMe = () => req<UserInfo>("/api/auth/me");

// --- Admin: user management ---
export const listUsers = () => req<UserInfo[]>("/api/auth/users");

export const updateUser = (userId: string, data: { name?: string; role?: string; is_active?: boolean }) =>
  req<UserInfo>(`/api/auth/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const adminCreateUser = (data: { email: string; password: string; name: string; role?: string }) =>
  req<UserInfo>("/api/auth/users", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const changeUserPassword = (userId: string, password: string, secret: string) =>
  req<{ ok: boolean; message: string }>(`/api/auth/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password, secret }),
  });

export const deleteUser = (userId: string) => del(`/api/auth/users/${userId}`);

// --- Admin: password reset requests ---
export const listPasswordResets = () => req<PasswordResetInfo[]>("/api/auth/password-resets");

export const approvePasswordReset = (resetId: string, tempPassword: string, secret: string) =>
  req<MessageResponse>(`/api/auth/password-resets/${resetId}/approve`, {
    method: "POST",
    body: JSON.stringify({ temp_password: tempPassword, secret }),
  });

export const rejectPasswordReset = (resetId: string) => del(`/api/auth/password-resets/${resetId}`);
