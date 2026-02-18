"use client"

import Link from "next/link"
import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Eye, EyeOff, CheckCircle2, TriangleAlert } from "lucide-react"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams?.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must include at least one letter and one number.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/password/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMap: Record<string, string> = {
          MISSING_FIELDS: "Token and new password are required.",
          WEAK_PASSWORD: "Password must be at least 8 characters with a letter and number.",
          INVALID_OR_USED_TOKEN: "This reset link is invalid or has already been used.",
          EXPIRED_TOKEN: "This reset link has expired. Please request a new one.",
        }
        setError(errorMap[data.error] || data.error || "Something went wrong.")
      } else {
        setSuccess(true)
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl text-center space-y-4">
          <TriangleAlert className="h-8 w-8 text-amber-400 mx-auto" />
          <h1 className="text-xl font-semibold">Invalid reset link</h1>
          <p className="text-sm text-white/60">This password reset link is missing or invalid.</p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-2.5 text-sm font-medium text-white transition"
          >
            Request new reset link
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl text-center space-y-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
          <h1 className="text-xl font-semibold">Password reset</h1>
          <p className="text-sm text-white/60">Your password has been updated. You can now sign in with your new password.</p>
          <Link
            href="/login"
            className="inline-block rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-2.5 text-sm font-medium text-white transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <Link
        href="/login"
        className="absolute left-4 top-4 md:left-6 md:top-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sign In
      </Link>

      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-2">
          <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AllFantasy.ai
          </div>
          <h1 className="mt-2 text-xl font-semibold">Set new password</h1>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-white/60">New password</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 pr-10 text-sm outline-none focus:border-white/20"
                  placeholder="At least 8 characters"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/60">Confirm password</label>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-white/20"
                placeholder="Confirm your new password"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
