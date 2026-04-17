"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { InfoHint } from "@/components/ui/info-hint";
import { StatusPing } from "@/components/ui/status-ping";
import * as api from "@/lib/api";

type EmailView = "login" | "register" | "forgot";

const INPUT =
  "w-full text-sm py-2.5 pr-3 border border-gray-200 dark:border-gray-600/80 rounded-xl bg-white/95 dark:bg-gray-800/95 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 transition-[box-shadow,border-color] duration-200 shadow-sm";

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconSpark({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function SignInHelpContent() {
  return (
    <>
      Use your email and password. Platform administrators can also use Username <strong>admin</strong> or email{" "}
      <code className="text-[10px]">admin@admin.com</code> (same password as the seeded admin).
    </>
  );
}

const BRAND_BULLETS = [
  "Wire Agentforce and other agents to projects, then drive structured test runs from one workspace.",
  "Record outcomes, dig into reports, and keep quality signals where your team already works.",
  "Orchestrate evaluations and iterations so shipping stays confident instead of last-minute guesswork.",
] as const;

const TABS: { id: EmailView; label: string; short: string }[] = [
  { id: "login", label: "Sign in", short: "Sign in" },
  { id: "register", label: "Create account", short: "Register" },
  { id: "forgot", label: "Forgot password", short: "Reset" },
];

export default function LoginPage() {
  const router = useRouter();
  const { handleLogin } = useAuth();
  const formId = useId();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorBump, setErrorBump] = useState(0);

  const [emailView, setEmailView] = useState<EmailView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function clearMessages() {
    setError("");
    setSuccessMsg("");
  }

  function setErrorWithMotion(msg: string) {
    setError(msg);
    setErrorBump((n) => n + 1);
  }

  function doLogin(token: string, user: api.UserInfo) {
    handleLogin(token, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      must_change_password: user.must_change_password,
      needs_company_onboarding: user.needs_company_onboarding,
      pending_company_edit: user.pending_company_edit,
    } as api.StoredUser);
    if (user.must_change_password) {
      router.replace(user.role === "admin" ? "/console/change-password" : "/change-password");
    } else if (user.role === "admin") {
      router.replace("/console");
    } else {
      router.replace("/dashboard");
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await api.login(email, password);
      doLogin(res.access_token, res.user);
    } catch (err) {
      setErrorWithMotion(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await api.register(email, password, name);
      setSuccessMsg(res.message);
      setEmailView("login");
    } catch (err) {
      setErrorWithMotion(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setSuccessMsg(res.message);
    } catch (err) {
      setErrorWithMotion(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function switchTab(next: EmailView) {
    setEmailView(next);
    clearMessages();
  }

  return (
    <div className="relative min-h-dvh flex flex-col overflow-x-hidden">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br from-indigo-100/90 via-white to-violet-100/80 dark:from-gray-950 dark:via-indigo-950/50 dark:to-violet-950/40"
        aria-hidden
      />
      <div
        className="ta-login-bg-orb pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-indigo-400/25 blur-3xl dark:bg-indigo-500/15 -z-10"
        aria-hidden
      />
      <div
        className="ta-login-bg-orb pointer-events-none absolute -bottom-40 -right-20 h-[26rem] w-[26rem] rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-600/10 -z-10 [animation-delay:-6s]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 25%, rgb(99 102 241 / 0.2), transparent 42%), radial-gradient(circle at 85% 70%, rgb(139 92 246 / 0.18), transparent 38%)",
        }}
        aria-hidden
      />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-14 items-center">
          {/* Brand column */}
          <div className="hidden lg:flex flex-col justify-center gap-8 pr-4 xl:pr-8">
            <div className="isolate">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600/10 dark:bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600/15 dark:ring-indigo-400/20 mb-5">
                <IconSpark className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                Quality engineering workspace
              </div>
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
                <span className="block leading-[1.15]">Testing</span>
                <span className="block leading-[1.2] pb-1 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent [background-clip:text] [-webkit-background-clip:text]">
                  Agent
                </span>
              </h1>
            </div>
            <ul className="mt-8 space-y-5 text-sm text-gray-600 dark:text-gray-400 max-w-md m-0 p-0 list-none leading-relaxed">
              {BRAND_BULLETS.map((text) => (
                <li key={text} className="flex gap-3.5 items-start">
                  <span className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden>
                    <StatusPing
                      tone="violet"
                      className="relative flex h-2 w-2 shrink-0 items-center justify-center"
                      size="h-2 w-2"
                    />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Card */}
          <div className="w-full max-w-md mx-auto lg:max-w-none">
            <div className="lg:hidden text-center mb-8">
              <h1 className="text-3xl font-black tracking-tight isolate">
                <span className="block text-gray-900 dark:text-white leading-[1.15]">Testing</span>
                <span className="block leading-[1.2] pb-0.5 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent [background-clip:text] [-webkit-background-clip:text]">
                  Agent
                </span>
              </h1>
            </div>

            <div className="rounded-2xl border border-white/60 dark:border-gray-700/80 bg-white/75 dark:bg-gray-900/75 backdrop-blur-xl shadow-xl shadow-indigo-950/10 dark:shadow-black/40 ring-1 ring-black/5 dark:ring-white/5">
              <div className="px-5 pt-5 pb-0 sm:px-6 sm:pt-6">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Welcome</p>
                  <InfoHint label="Sign in help" pingTone="violet">
                    <SignInHelpContent />
                  </InfoHint>
                </div>

                {/* Segmented tabs */}
                <div
                  className="mt-4 flex rounded-xl bg-gray-100/90 dark:bg-gray-800/90 p-1 gap-0.5 shadow-inner"
                  role="tablist"
                  aria-label="Sign-in options"
                >
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={emailView === t.id}
                      onClick={() => switchTab(t.id)}
                      className={`relative flex-1 min-w-0 rounded-lg py-2.5 px-2 text-center text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                        emailView === t.id
                          ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-200 shadow-md shadow-gray-200/80 dark:shadow-black/30"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      }`}
                    >
                      <span className="hidden sm:inline">{t.label}</span>
                      <span className="sm:hidden">{t.short}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 sm:p-6 sm:pt-5">
                {successMsg && (
                  <div className="mb-4 flex gap-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/90 dark:bg-emerald-950/35 px-3 py-3 text-emerald-800 dark:text-emerald-200">
                    <span className="text-lg leading-none" aria-hidden>
                      ✓
                    </span>
                    <p className="text-xs leading-relaxed m-0">{successMsg}</p>
                  </div>
                )}

                {error && (
                  <div
                    key={errorBump}
                    className="ta-login-shake mb-4 flex gap-3 rounded-xl border border-red-200/90 dark:border-red-900/50 bg-red-50/95 dark:bg-red-950/30 px-3 py-3 text-red-800 dark:text-red-200"
                    role="alert"
                  >
                    <span className="text-sm font-bold leading-none shrink-0" aria-hidden>
                      !
                    </span>
                    <p className="text-xs leading-relaxed m-0">{error}</p>
                  </div>
                )}

                {emailView === "login" && (
                  <form key={`${formId}-login`} onSubmit={handleEmailLogin} className="ta-login-panel flex flex-col gap-5">
                    <div>
                      <label htmlFor="email" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Email / Username
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                          <IconMail className="opacity-80" />
                        </span>
                        <input
                          id="email"
                          type="text"
                          autoComplete="username"
                          className={`${INPUT} pl-10`}
                          placeholder="you@company.com or admin"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                          <IconLock className="opacity-80" />
                        </span>
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          className={`${INPUT} pl-10 pr-11`}
                          placeholder="Your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <IconEyeOff /> : <IconEye />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !email.trim() || !password}
                      className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-indigo-600/35 hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-45 disabled:pointer-events-none disabled:shadow-none"
                    >
                      <span className="flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <Spinner />
                            Signing in…
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </span>
                    </button>
                  </form>
                )}

                {emailView === "register" && (
                  <form key={`${formId}-reg`} onSubmit={handleRegister} className="ta-login-panel flex flex-col gap-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed m-0">
                      Submit the form — an admin activates new accounts.
                    </p>
                    <div>
                      <label htmlFor="reg-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Full name
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                          <IconUser className="opacity-80" />
                        </span>
                        <input
                          id="reg-name"
                          type="text"
                          className={`${INPUT} pl-10`}
                          placeholder="Jane Doe"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-email" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                          <IconMail className="opacity-80" />
                        </span>
                        <input
                          id="reg-email"
                          type="email"
                          className={`${INPUT} pl-10`}
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-pass" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                          <IconLock className="opacity-80" />
                        </span>
                        <input
                          id="reg-pass"
                          type={showPassword ? "text" : "password"}
                          className={`${INPUT} pl-10 pr-11`}
                          placeholder="At least 4 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={4}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <IconEyeOff /> : <IconEye />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-45 disabled:pointer-events-none"
                    >
                      <span className="flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <Spinner />
                            Creating account…
                          </>
                        ) : (
                          "Create account"
                        )}
                      </span>
                    </button>
                  </form>
                )}

                {emailView === "forgot" && (
                  <form key={`${formId}-forgot`} onSubmit={handleForgotPassword} className="ta-login-panel flex flex-col gap-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed m-0">
                      Enter the email on your account. If it exists, an admin will see a reset request and can give you a temporary password.
                    </p>
                    <div>
                      <label htmlFor="forgot-email" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                          <IconMail className="opacity-80" />
                        </span>
                        <input
                          id="forgot-email"
                          type="email"
                          className={`${INPUT} pl-10`}
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-45 disabled:pointer-events-none"
                    >
                      <span className="flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <Spinner />
                            Sending…
                          </>
                        ) : (
                          "Request reset"
                        )}
                      </span>
                    </button>
                  </form>
                )}

                <p className="mt-5 text-center text-[11px] text-gray-500 dark:text-gray-500">New sign-ups need admin approval.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
