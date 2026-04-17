"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import * as api from "@/lib/api";
import { InfoHint } from "@/components/ui/info-hint";
import type { UserInfo, PasswordResetInfo, CompanyProfileEditRequestInfo } from "@/lib/api";

const INPUT_CLS =
  "w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

type Tab = "approvals" | "users" | "companyEdits";

export function AdminAccessPanel() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [tab, setTab] = useState<Tab>("approvals");

  const [pendingUsers, setPendingUsers] = useState<UserInfo[]>([]);
  const [resets, setResets] = useState<PasswordResetInfo[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [tempPwId, setTempPwId] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState("");
  const [resetSecretCode, setResetSecretCode] = useState("");

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", name: "", role: "member" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "member" });
  const [saving, setSaving] = useState(false);
  const [changingPwId, setChangingPwId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [reauthSecret, setReauthSecret] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [companyEdits, setCompanyEdits] = useState<CompanyProfileEditRequestInfo[]>([]);
  const [loadingCompanyEdits, setLoadingCompanyEdits] = useState(false);

  const loadCompanyEdits = useCallback(async () => {
    setLoadingCompanyEdits(true);
    try {
      setCompanyEdits(await api.listCompanyProfileEdits());
    } catch {
      setCompanyEdits([]);
    } finally {
      setLoadingCompanyEdits(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) router.replace("/dashboard");
  }, [isAdmin, router]);

  const loadApprovals = useCallback(async () => {
    setLoadingApprovals(true);
    try {
      const [allUsers, resetList] = await Promise.all([api.listUsers(), api.listPasswordResets()]);
      setPendingUsers(allUsers.filter((u) => !u.is_active));
      setResets(resetList);
    } catch {
      /* ignore */
    } finally {
      setLoadingApprovals(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUserError("");
    try {
      setUsers(await api.listUsers());
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadApprovals();
      loadUsers();
      loadCompanyEdits();
    }
  }, [isAdmin, loadApprovals, loadUsers, loadCompanyEdits]);

  async function handleApproveCompanyEdit(id: string) {
    if (!confirm("Approve this company profile update?")) return;
    try {
      await api.approveCompanyProfileEdit(id);
      await loadCompanyEdits();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleRejectCompanyEdit(id: string) {
    if (!confirm("Decline this update? The member keeps their current profile.")) return;
    try {
      await api.rejectCompanyProfileEdit(id);
      await loadCompanyEdits();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleActivateUser(u: UserInfo) {
    try {
      await api.updateUser(u.id, { is_active: true });
      await loadApprovals();
      await loadUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleRejectUser(u: UserInfo) {
    if (!confirm(`Permanently delete ${u.name} (${u.email})?`)) return;
    try {
      await api.deleteUser(u.id);
      await loadApprovals();
      await loadUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleApproveReset(id: string) {
    if (!tempPw.trim() || !resetSecretCode.trim()) return;
    try {
      await api.approvePasswordReset(id, tempPw.trim(), resetSecretCode.trim());
      setTempPwId(null);
      setTempPw("");
      setResetSecretCode("");
      await loadApprovals();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleRejectReset(id: string) {
    try {
      await api.rejectPasswordReset(id);
      await loadApprovals();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleCreateUser() {
    if (!createForm.email.trim() || !createForm.password.trim() || !createForm.name.trim()) {
      alert("All fields required.");
      return;
    }
    setCreating(true);
    try {
      await api.adminCreateUser({
        email: createForm.email.trim(),
        password: createForm.password.trim(),
        name: createForm.name.trim(),
        role: createForm.role,
      });
      setCreateForm({ email: "", password: "", name: "", role: "member" });
      setShowCreate(false);
      await loadUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(u: UserInfo) {
    setEditingId(u.id);
    setEditForm({ name: u.name, role: u.role });
    setChangingPwId(null);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      await api.updateUser(editingId, { name: editForm.name.trim(), role: editForm.role });
      setEditingId(null);
      await loadUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!changingPwId || !newPassword.trim() || !reauthSecret.trim()) return;
    setSavingPw(true);
    try {
      await api.changeUserPassword(changingPwId, newPassword.trim(), reauthSecret.trim());
      setChangingPwId(null);
      setNewPassword("");
      setReauthSecret("");
      alert("Password updated. User will be prompted to change it.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingPw(false);
    }
  }

  async function handleToggleActive(u: UserInfo) {
    const action = u.is_active ? "deactivate" : "activate";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${u.name}?`)) return;
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      await loadUsers();
      await loadApprovals();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleDeleteUser(u: UserInfo) {
    if (u.id === currentUser?.id) {
      alert("Cannot delete yourself.");
      return;
    }
    if (!confirm(`Permanently delete ${u.name} (${u.email})?`)) return;
    try {
      await api.deleteUser(u.id);
      await loadUsers();
      await loadApprovals();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!isAdmin) return null;

  const pendingCount = pendingUsers.length + resets.length;

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white m-0">Admin access</h1>
          <InfoHint label="Admin access">Pending approvals and user accounts.</InfoHint>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <div className="flex flex-wrap gap-0.5" role="tablist" aria-label="Admin sections">
            {(
              [
                {
                  id: "approvals" as const,
                  label: `Pending approvals${pendingUsers.length + resets.length > 0 ? ` (${pendingUsers.length + resets.length})` : ""}`,
                },
                {
                  id: "companyEdits" as const,
                  label: `Company profile edits${companyEdits.length > 0 ? ` (${companyEdits.length})` : ""}`,
                },
                { id: "users" as const, label: "User accounts" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                  tab === t.id
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "approvals" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400">{loadingApprovals ? "Loading…" : `${pendingCount} pending`}</p>
                <button
                  type="button"
                  onClick={loadApprovals}
                  disabled={loadingApprovals}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {pendingUsers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wider">
                    New registrations
                  </h3>
                  <div className="flex flex-col gap-2">
                    {pendingUsers.map((u) => (
                      <div
                        key={u.id}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                          <p className="text-xs text-gray-400">
                            {u.email} — registered {new Date(u.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleActivateUser(u)}
                            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium"
                          >
                            Activate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectUser(u)}
                            className="text-xs text-red-600 border border-red-200 dark:border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resets.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wider">
                    Password reset requests
                  </h3>
                  <div className="flex flex-col gap-2">
                    {resets.map((r) => (
                      <div key={r.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{r.user_name}</p>
                            <p className="text-xs text-gray-400">
                              {r.user_email} — requested {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setTempPwId(r.id);
                                setTempPw("");
                                setResetSecretCode("");
                              }}
                              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 font-medium"
                            >
                              Set temp password
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectReset(r.id)}
                              className="text-xs text-red-600 border border-red-200 dark:border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                        {tempPwId === r.id && (
                          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 sm:flex-row sm:flex-wrap sm:items-center">
                            <input
                              type="text"
                              placeholder="Temporary password for user"
                              value={tempPw}
                              onChange={(e) => setTempPw(e.target.value)}
                              className="flex-1 min-w-[10rem] text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <input
                              type="password"
                              placeholder="Secret code (confirm approval)"
                              value={resetSecretCode}
                              onChange={(e) => setResetSecretCode(e.target.value)}
                              autoComplete="off"
                              className="flex-1 min-w-[10rem] text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleApproveReset(r.id)}
                                disabled={!tempPw.trim() || !resetSecretCode.trim()}
                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTempPwId(null);
                                  setTempPw("");
                                  setResetSecretCode("");
                                }}
                                className="text-xs text-gray-500 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingUsers.length === 0 && resets.length === 0 && !loadingApprovals && (
                <p className="text-xs text-gray-400 text-center py-8">No pending approvals.</p>
              )}
            </div>
          )}

          {tab === "companyEdits" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400">
                  {loadingCompanyEdits ? "Loading…" : `${companyEdits.length} pending`}
                </p>
                <button
                  type="button"
                  onClick={loadCompanyEdits}
                  disabled={loadingCompanyEdits}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
              {companyEdits.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {companyEdits.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {r.user_name}{" "}
                        <span className="font-normal text-gray-500 dark:text-gray-400">({r.user_email})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Requested {new Date(r.created_at).toLocaleString()}
                      </p>
                      <dl className="mt-2 grid gap-1 text-sm">
                        <div>
                          <dt className="text-[10px] uppercase text-gray-400">Company</dt>
                          <dd className="text-gray-800 dark:text-gray-200">{r.proposed_company_name}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase text-gray-400">URL</dt>
                          <dd className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                            {r.proposed_company_url}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase text-gray-400">Industry</dt>
                          <dd className="capitalize text-gray-800 dark:text-gray-200">{r.proposed_industry}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleApproveCompanyEdit(r.id)}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectCompanyEdit(r.id)}
                          className="text-xs text-red-600 border border-red-200 dark:border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !loadingCompanyEdits && (
                  <p className="text-xs text-gray-400 text-center py-8">No pending company profile updates.</p>
                )
              )}
            </div>
          )}

          {tab === "users" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-400">
                    {loadingUsers ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""}`}
                  </p>
                  <button
                    type="button"
                    onClick={loadUsers}
                    disabled={loadingUsers}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate((v) => !v)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                >
                  {showCreate ? "Close" : "+ Create user"}
                </button>
              </div>
              {userError && <p className="text-xs text-red-500">{userError}</p>}

              {showCreate && (
                <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Create user account</h3>
                  <div className="grid grid-cols-2 gap-2 max-w-lg">
                    <input
                      placeholder="Full name *"
                      value={createForm.name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                      className={INPUT_CLS}
                    />
                    <input
                      placeholder="Email *"
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                      className={INPUT_CLS}
                    />
                    <input
                      placeholder="Password *"
                      type="text"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                      className={INPUT_CLS}
                    />
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                      className={INPUT_CLS}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleCreateUser}
                      disabled={creating}
                      className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {creating ? "Creating…" : "Create user"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {users.map((u) => {
                  const isMe = u.id === currentUser?.id;
                  const isEditing = editingId === u.id;
                  const isChangingPw = changingPwId === u.id;
                  return (
                    <div key={u.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              className={INPUT_CLS}
                              placeholder="Name"
                            />
                            <select
                              value={editForm.role}
                              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                              className={INPUT_CLS}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={saving}
                              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                u.is_active
                                  ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                              }`}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    u.role === "admin"
                                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                  }`}
                                >
                                  {u.role}
                                </span>
                                {!u.is_active && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">
                                    inactive
                                  </span>
                                )}
                                {isMe && <span className="text-[10px] text-gray-400 italic">you</span>}
                              </div>
                              <p className="text-xs text-gray-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          {!isMe && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEdit(u)}
                                className="text-[11px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setChangingPwId(u.id);
                                  setNewPassword("");
                                  setReauthSecret("");
                                  setEditingId(null);
                                }}
                                className="text-[11px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                Password
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(u)}
                                className={`text-[11px] px-2 py-1 rounded border ${
                                  u.is_active
                                    ? "text-amber-600 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                    : "text-green-600 border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-950/20"
                                }`}
                              >
                                {u.is_active ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="text-[11px] px-2 py-1 text-red-600 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {isChangingPw && !isEditing && (
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <input
                            type="password"
                            placeholder="Secret code (admin reset only)"
                            value={reauthSecret}
                            onChange={(e) => setReauthSecret(e.target.value)}
                            autoComplete="off"
                            className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleChangePassword}
                              disabled={savingPw || !newPassword.trim() || !reauthSecret.trim()}
                              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {savingPw ? "…" : "Set"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setChangingPwId(null);
                                setNewPassword("");
                                setReauthSecret("");
                              }}
                              className="text-xs text-gray-500 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
