"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import * as api from "@/lib/api";

const INPUT =
  "w-full text-sm px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400";

type Tab = "email" | "apikey";
type EmailView = "login" | "register" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const { handleLogin } = useAuth();

  const [tab, setTab] = useState<Tab>("email");
  const [showAdmin, setShowAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Admin state
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPass, setAdminPass] = useState("");

  // Email/password state
  const [emailView, setEmailView] = useState<EmailView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // API key state
  const [masterKey, setMasterKey] = useState("");
  const [masterVerified, setMasterVerified] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<api.ApiKeyCreated | null>(null);
  const [directKey, setDirectKey] = useState("");

  function clearMessages() { setError(""); setSuccessMsg(""); }

  function doLogin(token: string, user: api.UserInfo) {
    handleLogin(token, { id: user.id, email: user.email, name: user.name, role: user.role, must_change_password: user.must_change_password } as api.StoredUser);
    if (user.must_change_password) {
      router.replace("/change-password");
    } else {
      router.replace("/dashboard");
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await api.adminLogin(adminUser, adminPass);
      doLogin(res.access_token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await api.login(email, password);
      doLogin(res.access_token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
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
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally { setLoading(false); }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setSuccessMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally { setLoading(false); }
  }

  async function handleVerifyMaster() {
    clearMessages();
    setLoading(true);
    try {
      await api.verifyKey(masterKey);
      setMasterVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid master key");
    } finally { setLoading(false); }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    clearMessages();
    setLoading(true);
    try {
      const k = await api.createApiKey(newKeyName.trim(), masterKey);
      setCreatedKey(k);
      setNewKeyName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally { setLoading(false); }
  }

  async function handleApiKeyLogin(key: string) {
    clearMessages();
    setLoading(true);
    try {
      await api.verifyKey(key);
      api.setStoredKey(key);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid API key");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-gray-900 dark:text-white">Testing </span>
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Agent</span>
          </h1>
        </div>

        {/* Admin toggle */}
        <div className="text-center mb-3">
          <button type="button" onClick={() => { setShowAdmin(!showAdmin); clearMessages(); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {showAdmin ? "Hide admin login" : "Admin?"}
          </button>
        </div>

        {/* Admin login */}
        {showAdmin && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-4">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">Admin Login</h2>
            <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
              <input className={INPUT} placeholder="Username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} required />
              <input className={INPUT} type="password" placeholder="Password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} required />
              {error && showAdmin && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={loading} className="w-full text-sm font-medium bg-amber-600 text-white py-2.5 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {loading ? "Signing in..." : "Admin Sign In"}
              </button>
            </form>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => { setTab("email"); clearMessages(); }}
              className={`flex-1 text-sm font-medium py-3 transition-colors ${
                tab === "email"
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Email &amp; Password
            </button>
            <button
              type="button"
              onClick={() => { setTab("apikey"); clearMessages(); }}
              className={`flex-1 text-sm font-medium py-3 transition-colors ${
                tab === "apikey"
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              API Key
            </button>
          </div>

          <div className="p-6">
            {/* Success message */}
            {successMsg && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-xs text-green-700 dark:text-green-300">{successMsg}</p>
              </div>
            )}

            {/* ── Email & Password tab ── */}
            {tab === "email" && (
              <>
                {emailView === "login" && (
                  <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sign in with your email and password.</p>
                    <div>
                      <label htmlFor="email" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
                      <input id="email" type="email" className={INPUT} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
                      <input id="password" type="password" className={INPUT} placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {error && !showAdmin && <p className="text-xs text-red-500">{error}</p>}
                    <button type="submit" disabled={loading || !email || !password} className="w-full text-sm font-medium bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {loading ? "Signing in..." : "Sign In"}
                    </button>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => { setEmailView("register"); clearMessages(); }} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        Don&apos;t have an account? Register
                      </button>
                      <button type="button" onClick={() => { setEmailView("forgot"); clearMessages(); }} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
                        Forgot password?
                      </button>
                    </div>
                  </form>
                )}

                {emailView === "register" && (
                  <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Create a new account. An admin will activate it.</p>
                    <div>
                      <label htmlFor="reg-name" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Full Name</label>
                      <input id="reg-name" type="text" className={INPUT} placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                    </div>
                    <div>
                      <label htmlFor="reg-email" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
                      <input id="reg-email" type="email" className={INPUT} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                      <label htmlFor="reg-pass" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
                      <input id="reg-pass" type="password" className={INPUT} placeholder="Min 4 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} />
                    </div>
                    {error && !showAdmin && <p className="text-xs text-red-500">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full text-sm font-medium bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {loading ? "Registering..." : "Register"}
                    </button>
                    <button type="button" onClick={() => { setEmailView("login"); clearMessages(); }} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                      Already have an account? Sign in
                    </button>
                  </form>
                )}

                {emailView === "forgot" && (
                  <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enter your email. The admin will set a temporary password for you.</p>
                    <div>
                      <label htmlFor="forgot-email" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
                      <input id="forgot-email" type="email" className={INPUT} placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                    </div>
                    {error && !showAdmin && <p className="text-xs text-red-500">{error}</p>}
                    <button type="submit" disabled={loading || !email} className="w-full text-sm font-medium bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {loading ? "Submitting..." : "Request Password Reset"}
                    </button>
                    <button type="button" onClick={() => { setEmailView("login"); clearMessages(); }} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                      Back to sign in
                    </button>
                  </form>
                )}
              </>
            )}

            {/* ── API Key tab ── */}
            {tab === "apikey" && (
              <div className="flex flex-col gap-4">
                {!masterVerified ? (
                  <>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enter the master key to generate a new API key, or sign in with an existing key.</p>

                    {/* Master key verification */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Master Key</label>
                      <div className="flex gap-2">
                        <input type="password" className={`flex-1 ${INPUT}`} placeholder="Enter master key" value={masterKey} onChange={(e) => setMasterKey(e.target.value)} />
                        <button type="button" onClick={handleVerifyMaster} disabled={loading || !masterKey} className="text-xs bg-gray-800 dark:bg-gray-700 text-white px-4 py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium shrink-0">
                          {loading ? "..." : "Verify"}
                        </button>
                      </div>
                    </div>

                    {/* Direct key login */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Or sign in with an existing API key</label>
                      <div className="flex gap-2">
                        <input type="password" className={`flex-1 ${INPUT}`} placeholder="ta_xxxxxxxx..." value={directKey} onChange={(e) => setDirectKey(e.target.value)} />
                        <button type="button" onClick={() => handleApiKeyLogin(directKey)} disabled={loading || !directKey} className="text-xs bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shrink-0">
                          {loading ? "..." : "Sign In"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      Master key verified
                    </div>

                    {/* Generate new key */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Create a new API key</label>
                      <div className="flex gap-2">
                        <input type="text" className={`flex-1 ${INPUT}`} placeholder="Key name (e.g. alice, ci-bot)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateKey(); }} />
                        <button type="button" onClick={handleCreateKey} disabled={loading || !newKeyName.trim()} className="text-xs bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shrink-0">
                          {loading ? "..." : "Create"}
                        </button>
                      </div>
                    </div>

                    {/* Show created key */}
                    {createdKey && (
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">
                          Key created for <strong>{createdKey.name}</strong> — copy it now, it won&apos;t be shown again.
                        </p>
                        <code className="block text-xs bg-white dark:bg-gray-900 border border-green-200 dark:border-green-700 rounded p-2 break-all select-all text-gray-900 dark:text-white mb-3">
                          {createdKey.plain_key}
                        </code>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => navigator.clipboard.writeText(createdKey.plain_key)} className="text-xs text-green-700 dark:text-green-400 hover:underline">
                            Copy to clipboard
                          </button>
                          <button type="button" onClick={() => handleApiKeyLogin(createdKey.plain_key)} disabled={loading} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                            Use this key to sign in
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Direct key login */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Or sign in with an existing API key</label>
                      <div className="flex gap-2">
                        <input type="password" className={`flex-1 ${INPUT}`} placeholder="ta_xxxxxxxx..." value={directKey} onChange={(e) => setDirectKey(e.target.value)} />
                        <button type="button" onClick={() => handleApiKeyLogin(directKey)} disabled={loading || !directKey} className="text-xs bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shrink-0">
                          {loading ? "..." : "Sign In"}
                        </button>
                      </div>
                    </div>

                    <button type="button" onClick={() => { setMasterVerified(false); setMasterKey(""); setCreatedKey(null); }} className="text-xs text-gray-400 hover:underline self-start">
                      Use a different master key
                    </button>
                  </>
                )}

                {error && tab === "apikey" && <p className="text-xs text-red-500">{error}</p>}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          New users must be activated by an admin after registration.
        </p>
      </div>
    </div>
  );
}
