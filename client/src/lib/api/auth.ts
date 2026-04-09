import { BASE, req } from "./client";
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

async function authFetch<T>(url: string, init: RequestInit, fallbackMsg: string): Promise<T> {
  const r = await fetch(url, init);
  const body = await parseBody(r);
  if (!r.ok) throw new Error(formatAuthError(r, body, fallbackMsg));
  return body as T;
}

// --- Admin login (seeded admin, username/password) ---
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
export const changeMyPassword = (currentPassword: string, newPassword: string) =>
  req<MessageResponse>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
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

export const changeUserPassword = (userId: string, password: string) =>
  req<{ ok: boolean; message: string }>(`/api/auth/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });

export const deleteUser = (userId: string) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("ta_jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    else {
      const key = localStorage.getItem("ta_api_key");
      if (key) headers["X-API-Key"] = key;
    }
  }
  return fetch(`${BASE}/api/auth/users/${userId}`, {
    method: "DELETE",
    headers,
  }).then(async (r) => {
    if (!r.ok && r.status !== 204) {
      const body = await r.json().catch(() => ({}));
      throw new Error((body as { detail?: string }).detail ?? "Delete failed");
    }
  });
};

// --- Admin: password reset requests ---
export const listPasswordResets = () => req<PasswordResetInfo[]>("/api/auth/password-resets");

export const approvePasswordReset = (resetId: string, tempPassword: string) =>
  req<MessageResponse>(`/api/auth/password-resets/${resetId}/approve`, {
    method: "POST",
    body: JSON.stringify({ temp_password: tempPassword }),
  });

export const rejectPasswordReset = (resetId: string) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("ta_jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    else {
      const key = localStorage.getItem("ta_api_key");
      if (key) headers["X-API-Key"] = key;
    }
  }
  return fetch(`${BASE}/api/auth/password-resets/${resetId}`, {
    method: "DELETE",
    headers,
  }).then(async (r) => {
    if (!r.ok && r.status !== 204) {
      const body = await r.json().catch(() => ({}));
      throw new Error((body as { detail?: string }).detail ?? "Failed to reject");
    }
  });
};
