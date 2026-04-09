"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import * as api from "@/lib/api";
import type { UserInfo, ApiKeyInfo, ApiKeyCreated, PasswordResetInfo } from "@/lib/api";

const INPUT_CLS =
  "w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

type Tab = "approvals" | "users" | "keys";

export default function AdminPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [tab, setTab] = useState<Tab>("approvals");

  // --- Pending approvals state ---
  const [pendingUsers, setPendingUsers] = useState<UserInfo[]>([]);
  const [resets, setResets] = useState<PasswordResetInfo[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [tempPwId, setTempPwId] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState("");

  // --- User management state ---
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
  const [savingPw, setSavingPw] = useState(false);

  // --- API key state ---
  const [masterDraft, setMasterDraft] = useState("");
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [masterError, setMasterError] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);

  useEffect(() => { if (!isAdmin) router.replace("/dashboard"); }, [isAdmin, router]);

  // --- Approval loaders ---
  const loadApprovals = useCallback(async () => {
    setLoadingApprovals(true);
    try {
      const [allUsers, resetList] = await Promise.all([api.listUsers(), api.listPasswordResets()]);
      setPendingUsers(allUsers.filter((u) => !u.is_active));
      setResets(resetList);
    } catch { /* ignore */ } finally { setLoadingApprovals(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUserError("");
    try { setUsers(await api.listUsers()); } catch (e: unknown) { setUserError(e instanceof Error ? e.message : "Failed"); } finally { setLoadingUsers(false); }
  }, []);

  useEffect(() => { if (isAdmin) { loadApprovals(); loadUsers(); } }, [isAdmin, loadApprovals, loadUsers]);

  // --- Approval handlers ---
  async function handleActivateUser(u: UserInfo) {
    try { await api.updateUser(u.id, { is_active: true }); await loadApprovals(); await loadUsers(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleRejectUser(u: UserInfo) {
    if (!confirm(`Permanently delete ${u.name} (${u.email})?`)) return;
    try { await api.deleteUser(u.id); await loadApprovals(); await loadUsers(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleApproveReset(id: string) {
    if (!tempPw.trim()) return;
    try { await api.approvePasswordReset(id, tempPw.trim()); setTempPwId(null); setTempPw(""); await loadApprovals(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleRejectReset(id: string) {
    try { await api.rejectPasswordReset(id); await loadApprovals(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  // --- User CRUD handlers ---
  async function handleCreateUser() {
    if (!createForm.email.trim() || !createForm.password.trim() || !createForm.name.trim()) { alert("All fields required."); return; }
    setCreating(true);
    try { await api.adminCreateUser({ email: createForm.email.trim(), password: createForm.password.trim(), name: createForm.name.trim(), role: createForm.role }); setCreateForm({ email: "", password: "", name: "", role: "member" }); setShowCreate(false); await loadUsers(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); } finally { setCreating(false); }
  }

  function startEdit(u: UserInfo) { setEditingId(u.id); setEditForm({ name: u.name, role: u.role }); setChangingPwId(null); }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try { await api.updateUser(editingId, { name: editForm.name.trim(), role: editForm.role }); setEditingId(null); await loadUsers(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); } finally { setSaving(false); }
  }

  async function handleChangePassword() {
    if (!changingPwId || !newPassword.trim()) return;
    setSavingPw(true);
    try { await api.changeUserPassword(changingPwId, newPassword.trim()); setChangingPwId(null); setNewPassword(""); alert("Password updated. User will be prompted to change it."); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); } finally { setSavingPw(false); }
  }

  async function handleToggleActive(u: UserInfo) {
    const action = u.is_active ? "deactivate" : "activate";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${u.name}?`)) return;
    try { await api.updateUser(u.id, { is_active: !u.is_active }); await loadUsers(); await loadApprovals(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleDeleteUser(u: UserInfo) {
    if (u.id === currentUser?.id) { alert("Cannot delete yourself."); return; }
    if (!confirm(`Permanently delete ${u.name} (${u.email})?`)) return;
    try { await api.deleteUser(u.id); await loadUsers(); await loadApprovals(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  // --- API key handlers ---
  async function handleLoadKeys() {
    setLoadingKeys(true); setMasterError("");
    try { setKeys(await api.listApiKeys(masterDraft)); } catch (e: unknown) { setMasterError(e instanceof Error ? e.message : "Failed"); setKeys([]); } finally { setLoadingKeys(false); }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true); setCreatedKey(null);
    try { const k = await api.createApiKey(newKeyName.trim(), masterDraft); setCreatedKey(k); setNewKeyName(""); await handleLoadKeys(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); } finally { setCreatingKey(false); }
  }

  async function handleRevokeKey(id: string) { if (!confirm("Revoke this key?")) return; await api.revokeApiKey(id, masterDraft); await handleLoadKeys(); }

  async function handleReactivateKey(id: string) { try { await api.reactivateApiKey(id, masterDraft); await handleLoadKeys(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); } }

  async function handleDeleteKeyPermanently(id: string, name: string) { if (!confirm(`Permanently delete key "${name}"? This frees the name for reuse.`)) return; try { await api.deleteApiKeyPermanently(id, masterDraft); await handleLoadKeys(); } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); } }

  if (!isAdmin) return null;

  const pendingCount = pendingUsers.length + resets.length;

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Admin Access</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage users, approvals, and API keys.</p>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 pb-px">
            {([
              { id: "approvals" as const, label: `Pending Approvals${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
              { id: "users" as const, label: "User Accounts" },
              { id: "keys" as const, label: "API Keys" },
            ]).map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-xs font-medium rounded-t-md transition-colors ${
                  tab === t.id ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border border-b-0 border-gray-200 dark:border-gray-700 -mb-px" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Approvals tab ── */}
          {tab === "approvals" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400">{loadingApprovals ? "Loading..." : `${pendingCount} pending`}</p>
                <button onClick={loadApprovals} disabled={loadingApprovals} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">Refresh</button>
              </div>

              {/* Pending registrations */}
              {pendingUsers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wider">New Registrations</h3>
                  <div className="flex flex-col gap-2">
                    {pendingUsers.map((u) => (
                      <div key={u.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email} — registered {new Date(u.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => handleActivateUser(u)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium">Activate</button>
                          <button onClick={() => handleRejectUser(u)} className="text-xs text-red-600 border border-red-200 dark:border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Password reset requests */}
              {resets.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wider">Password Reset Requests</h3>
                  <div className="flex flex-col gap-2">
                    {resets.map((r) => (
                      <div key={r.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{r.user_name}</p>
                            <p className="text-xs text-gray-400">{r.user_email} — requested {new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => { setTempPwId(r.id); setTempPw(""); }} className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 font-medium">Set Temp Password</button>
                            <button onClick={() => handleRejectReset(r.id)} className="text-xs text-red-600 border border-red-200 dark:border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">Dismiss</button>
                          </div>
                        </div>
                        {tempPwId === r.id && (
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <input type="text" placeholder="Temporary password" value={tempPw} onChange={(e) => setTempPw(e.target.value)} className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            <button onClick={() => handleApproveReset(r.id)} disabled={!tempPw.trim()} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">Approve</button>
                            <button onClick={() => setTempPwId(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingCount === 0 && !loadingApprovals && (
                <p className="text-xs text-gray-400 text-center py-8">No pending approvals.</p>
              )}
            </div>
          )}

          {/* ── Users tab ── */}
          {tab === "users" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-400">{loadingUsers ? "Loading..." : `${users.length} user${users.length !== 1 ? "s" : ""}`}</p>
                  <button onClick={loadUsers} disabled={loadingUsers} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">Refresh</button>
                </div>
                <button type="button" onClick={() => setShowCreate((v) => !v)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">{showCreate ? "Close" : "+ Create User"}</button>
              </div>
              {userError && <p className="text-xs text-red-500">{userError}</p>}

              {showCreate && (
                <div className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Create User Account</h3>
                  <div className="grid grid-cols-2 gap-2 max-w-lg">
                    <input placeholder="Full Name *" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} />
                    <input placeholder="Email *" type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className={INPUT_CLS} />
                    <input placeholder="Password *" type="text" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} className={INPUT_CLS} />
                    <select value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))} className={INPUT_CLS}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={handleCreateUser} disabled={creating} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{creating ? "Creating..." : "Create User"}</button>
                    <button type="button" onClick={() => setShowCreate(false)} className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
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
                            <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={INPUT_CLS} placeholder="Name" />
                            <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className={INPUT_CLS}>
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={handleSaveEdit} disabled={saving} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                            <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${u.is_active ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>{u.role}</span>
                                {!u.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">inactive</span>}
                                {isMe && <span className="text-[10px] text-gray-400 italic">you</span>}
                              </div>
                              <p className="text-xs text-gray-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          {!isMe && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => startEdit(u)} className="text-[11px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800">Edit</button>
                              <button onClick={() => { setChangingPwId(u.id); setNewPassword(""); setEditingId(null); }} className="text-[11px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800">Password</button>
                              <button onClick={() => handleToggleActive(u)} className={`text-[11px] px-2 py-1 rounded border ${u.is_active ? "text-amber-600 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/20" : "text-green-600 border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-950/20"}`}>{u.is_active ? "Deactivate" : "Activate"}</button>
                              <button onClick={() => handleDeleteUser(u)} className="text-[11px] px-2 py-1 text-red-600 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/20">Delete</button>
                            </div>
                          )}
                        </div>
                      )}
                      {isChangingPw && !isEditing && (
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                          <input type="text" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          <button type="button" onClick={handleChangePassword} disabled={savingPw || !newPassword.trim()} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">{savingPw ? "..." : "Set"}</button>
                          <button type="button" onClick={() => setChangingPwId(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── API Keys tab ── */}
          {tab === "keys" && (
            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Master Key</h3>
                <p className="text-xs text-gray-400 mb-3">Enter the <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">MASTER_API_KEY</code> from <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">server/.env</code>.</p>
                <div className="flex gap-2">
                  <input type="password" placeholder="Master key" value={masterDraft} onChange={(e) => setMasterDraft(e.target.value)} className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  <button onClick={handleLoadKeys} disabled={loadingKeys || !masterDraft} className="text-xs bg-gray-800 dark:bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium">{loadingKeys ? "Loading..." : "Load Keys"}</button>
                </div>
                {masterError && <p className="text-xs text-red-500 mt-2">{masterError}</p>}
              </div>

              {masterDraft && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Generate New API Key</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Key name (e.g. alice, ci-bot)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateKey(); }} className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">{creatingKey ? "Creating..." : "Create Key"}</button>
                  </div>
                  {createdKey && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Key created for <strong>{createdKey.name}</strong> — copy it now.</p>
                      <code className="block text-xs bg-white dark:bg-gray-900 border border-green-200 dark:border-green-700 rounded p-2 break-all select-all text-gray-900 dark:text-white">{createdKey.plain_key}</code>
                      <button onClick={() => navigator.clipboard.writeText(createdKey.plain_key)} className="mt-2 text-xs text-green-700 dark:text-green-400 hover:underline">Copy</button>
                    </div>
                  )}
                </div>
              )}

              {keys.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-2">{keys.length} key{keys.length !== 1 ? "s" : ""}</p>
                  <div className="flex flex-col gap-2">
                    {keys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${k.is_active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{k.name}</p>
                            <p className="text-xs text-gray-400">Created {new Date(k.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {k.is_active ? (
                            <button onClick={() => handleRevokeKey(k.id)} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium">Revoke</button>
                          ) : (
                            <>
                              <span className="text-xs text-gray-400 mr-1">Revoked</span>
                              <button onClick={() => handleReactivateKey(k.id)} className="text-[11px] px-2 py-1 text-green-600 border border-green-200 dark:border-green-900 rounded hover:bg-green-50 dark:hover:bg-green-950/20">Unrevoke</button>
                              <button onClick={() => handleDeleteKeyPermanently(k.id, k.name)} className="text-[11px] px-2 py-1 text-red-600 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/20">Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
