"use client"

import Link from "next/link"
import { useState } from "react"
import { signIn } from "next-auth/react"
import {
  ArrowLeft,
  Shield,
  Mail,
  Loader2,
  TriangleAlert,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"

export default function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams?.get("callbackUrl") || searchParams?.get("next") || "/dashboard"
  const isAdminLogin = callbackUrl.startsWith("/admin")

  const [mode, setMode] = useState<"password" | "magic">("password")
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [showAdmin, setShowAdmin] = useState(isAdminLogin)
  const [adminPassword, setAdminPassword] = useState("")
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [adminRemaining, setAdminRemaining] = useState<number | null>(null)

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        login: login.trim(),
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError("Invalid email/username or password.")
      } else if (result?.url) {
        router.push(result.url)
      } else {
        router.push(callbackUrl)
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.")
      return
    }

    setSending(true)
    try {
      const result = await signIn("email", {
        email: email.trim(),
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError("Something went wrong. Please try again.")
      } else {
        setSent(true)
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSending(false)
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setAdminError(null)

    if (!adminPassword.trim()) {
      setAdminError("Please enter the admin password.")
      return
    }

    setAdminLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, next: "/admin" }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.ok) {
        setAdminError(data?.error || "Login failed.")
        setAdminRemaining(typeof data?.remaining === "number" ? data.remaining : null)
        return
      }

      window.location.href = data.next || "/admin"
    } catch (err: any) {
      setAdminError(err?.message || "Login failed.")
    } finally {
      setAdminLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl text-center">
          <div className="mx-auto w-fit rounded-xl border border-white/10 bg-black/20 p-3">
            <Mail className="h-6 w-6 text-cyan-400" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-white/60">
            We sent a sign-in link to <span className="text-white/90 font-medium">{email}</span>.
            Click the link in the email to sign in.
          </p>
          <p className="mt-4 text-xs text-white/40">
            The link expires in 24 hours. If you don&apos;t see it, check your spam folder.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 transition"
          >
            Continue to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <Link
        href="/"
        className="absolute left-4 top-4 md:left-6 md:top-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="w-full max-w-md space-y-4">
        {isAdminLogin ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                <Shield className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-xl font-semibold">Admin Sign In</div>
                <div className="text-sm text-white/60">Enter the admin password to continue.</div>
              </div>
            </div>

            {adminError && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    {adminError}
                    {typeof adminRemaining === "number" && (
                      <span className="ml-1 text-xs text-red-200/70">
                        ({adminRemaining} attempts remaining)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="mt-5 space-y-3">
              <div>
                <label className="text-sm text-white/70">Password</label>
                <input
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="Enter admin password"
                  disabled={adminLoading}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={adminLoading || !adminPassword.trim()}
                className="w-full rounded-xl bg-white text-black px-4 py-2.5 text-sm font-medium hover:bg-gray-200 disabled:opacity-60 transition-colors"
              >
                {adminLoading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="text-center mb-2">
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                AllFantasy.ai
              </div>
              <h1 className="mt-2 text-xl font-semibold">Welcome back</h1>
            </div>

            <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 gap-1">
              <button
                type="button"
                onClick={() => { setMode("password"); setError(null) }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === "password" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                }`}
              >
                <KeyRound className="h-4 w-4" />
                Password
              </button>
              <button
                type="button"
                onClick={() => { setMode("magic"); setError(null) }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === "magic" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                }`}
              >
                <Mail className="h-4 w-4" />
                Magic Link
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>{error}</div>
                </div>
              </div>
            )}

            {mode === "password" ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl">
                <form onSubmit={handlePasswordLogin} className="space-y-3">
                  <div>
                    <label className="text-xs text-white/60">Email or Username</label>
                    <input
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      type="text"
                      autoComplete="username"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-white/20"
                      placeholder="you@example.com or username"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Password</label>
                    <div className="relative">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 pr-10 text-sm outline-none focus:border-white/20"
                        placeholder="Your password"
                        disabled={loading}
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
                  <button
                    type="submit"
                    disabled={loading || !login.trim() || !password}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl">
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <div>
                    <label className="text-xs text-white/60">Email</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-white/20"
                      placeholder="you@example.com"
                      disabled={sending}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !email.trim()}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 transition-all"
                  >
                    {sending ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending link...
                      </span>
                    ) : (
                      "Send sign-in link"
                    )}
                  </button>
                </form>
                <p className="mt-3 text-xs text-white/40 text-center">
                  No password needed. We&apos;ll email you a one-time link to sign in.
                </p>
              </div>
            )}

            <p className="text-center text-sm text-white/40">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-white/80 hover:text-white hover:underline transition">
                Sign up
              </Link>
            </p>

            <div className="rounded-2xl border border-white/10 bg-white/5 shadow-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdmin((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm text-white/50 hover:text-white/70 transition"
              >
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Admin login
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAdmin ? "rotate-180" : ""}`}
                />
              </button>

              {showAdmin && (
                <div className="px-5 pb-5 pt-1 border-t border-white/5">
                  {adminError && (
                    <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                      <div className="flex items-start gap-2">
                        <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                          {adminError}
                          {typeof adminRemaining === "number" && (
                            <span className="ml-1 text-xs text-red-200/70">
                              ({adminRemaining} attempts remaining)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <div>
                      <label className="text-xs text-white/60">Admin password</label>
                      <input
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        type="password"
                        autoComplete="current-password"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20"
                        placeholder="Enter admin password"
                        disabled={adminLoading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={adminLoading || !adminPassword.trim()}
                      className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-60 transition"
                    >
                      {adminLoading ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in...
                        </span>
                      ) : (
                        "Admin sign in"
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
