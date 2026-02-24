"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Search,
  RefreshCw,
  Trash2,
  Users,
  KeyRound,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Mail,
  Shield,
} from "lucide-react"

interface AppUser {
  id: string
  email: string
  username: string
  emailVerified: boolean
  phoneVerified: boolean
  verificationMethod: string | null
  profileComplete: boolean
  sleeperUsername: string | null
  createdAt: string
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    })
  } catch {
    return iso
  }
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState("")

  const [resetLoading, setResetLoading] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<{ userId: string; ok: boolean; message: string } | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load users")
      setUsers(data?.users || [])
    } catch (e: any) {
      setError(e.message || "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.sleeperUsername?.toLowerCase().includes(q)
    )
  }, [users, searchQ])

  const handleResetPassword = async (user: AppUser) => {
    if (!confirm(`Send a password reset link to ${user.email}?`)) return

    setResetLoading(user.id)
    setResetResult(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to send reset link")
      setResetResult({ userId: user.id, ok: true, message: data.message || "Reset link sent!" })
    } catch (e: any) {
      setResetResult({ userId: user.id, ok: false, message: e.message || "Failed" })
    } finally {
      setResetLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteResult(null)
    try {
      const res = await fetch(`/api/admin/users/${deleteConfirm.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to delete user")
      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id))
      setDeleteResult({ ok: true, message: data.message || "User deleted" })
      setDeleteConfirm(null)
    } catch (e: any) {
      setDeleteResult({ ok: false, message: e.message || "Failed to delete" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
              Registered Users
            </h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {users.length} total users
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--muted2)" }} />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search email or username..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border text-sm outline-none transition"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in srgb, var(--text) 5%, transparent)",
                color: "var(--text)",
              }}
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="h-10 w-10 flex items-center justify-center rounded-xl border hover:opacity-80 transition"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--muted)" }} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {resetResult && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            resetResult.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {resetResult.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            {resetResult.message}
          </div>
        </div>
      )}

      {deleteResult && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            deleteResult.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {deleteResult.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            {deleteResult.message}
          </div>
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--muted)" }}>
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--muted)" }}>
                    Joined
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>
                      {searchQ ? "No users match your search" : "No registered users found"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t transition hover:bg-white/[0.02]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted2)" }} />
                          <span className="font-medium truncate max-w-[200px]" style={{ color: "var(--text)" }}>
                            {user.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span style={{ color: "var(--muted)" }}>{user.username}</span>
                        {user.sleeperUsername && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Sleeper
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          {user.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertTriangle className="h-3 w-3" />
                              Unverified
                            </span>
                          )}
                          {user.profileComplete && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Shield className="h-3 w-3" />
                              Complete
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {fmtDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={resetLoading === user.id || !user.email}
                            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
                            style={{
                              borderColor: "var(--border)",
                              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                              color: "var(--accent)",
                            }}
                            title="Send password reset email"
                          >
                            {resetLoading === user.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <KeyRound className="h-3.5 w-3.5" />
                            )}
                            Reset PW
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirm(user)
                              setDeleteResult(null)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-red-400 border-red-500/20 bg-red-500/10 transition hover:bg-red-500/20 disabled:opacity-50"
                            title="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirm(null)} />
          <div
            className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4"
            style={{ borderColor: "var(--border)", background: "var(--panel)" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 border border-red-500/30">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text)" }}>
                  Delete User
                </h3>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {deleteConfirm.email}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Username: {deleteConfirm.username} | Joined: {fmtDate(deleteConfirm.createdAt)}
              </p>
            </div>

            <p className="text-sm" style={{ color: "var(--muted)" }}>
              This will permanently delete the user account, profile, and all verification tokens. Are you sure?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  "Delete User"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
