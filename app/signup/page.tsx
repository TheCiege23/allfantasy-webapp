"use client"

import { useState, useCallback } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Loader2,
  TriangleAlert,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  XCircle,
  User,
} from "lucide-react"

interface SleeperResult {
  found: boolean
  username?: string
  userId?: string
  displayName?: string
  avatar?: string | null
}

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [phone, setPhone] = useState("")
  const [sleeperUsername, setSleeperUsername] = useState("")
  const [sleeperResult, setSleeperResult] = useState<SleeperResult | null>(null)
  const [sleeperLooking, setSleeperLooking] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const lookupSleeper = useCallback(async () => {
    if (!sleeperUsername.trim() || sleeperLooking) return
    setSleeperLooking(true)
    setSleeperResult(null)
    try {
      const res = await fetch(`/api/auth/sleeper-lookup?username=${encodeURIComponent(sleeperUsername.trim())}`)
      const data = await res.json()
      setSleeperResult(data)
    } catch {
      setSleeperResult({ found: false })
    } finally {
      setSleeperLooking(false)
    }
  }, [sleeperUsername, sleeperLooking])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          displayName: displayName.trim() || username.trim(),
          phone: phone.trim() || undefined,
          sleeperUsername: sleeperResult?.found ? sleeperResult.username : undefined,
          ageConfirmed,
          verificationMethod: "EMAIL",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong.")
        setLoading(false)
        return
      }

      const loginRes = await signIn("credentials", {
        redirect: false,
        login: email.trim(),
        password,
      })

      if (!loginRes?.ok) {
        setSuccess(true)
        setLoading(false)
        return
      }

      router.push("/verify")
    } catch {
      setError("Something went wrong. Please try again.")
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl text-center space-y-4">
          <div className="mx-auto w-fit rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold">Account created!</h1>
          <p className="text-sm text-white/60">
            We sent a verification link to <span className="text-white/90 font-medium">{email}</span>.
            Click the link to verify your email, then sign in.
          </p>
          <p className="text-xs text-white/40">
            The link expires in 1 hour. Check your spam folder if you don't see it.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-xl bg-white text-black px-6 py-2.5 text-sm font-medium hover:bg-gray-200 transition"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4 py-8">
      <Link
        href="/"
        className="absolute left-4 top-4 md:left-6 md:top-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AllFantasy.ai
          </div>
          <h1 className="mt-2 text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-white/60">
            Join the AI-powered fantasy sports platform.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Username *</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
              placeholder="your_username"
              maxLength={30}
              autoComplete="username"
              required
            />
            <p className="mt-1 text-xs text-white/30">Letters, numbers, underscores. 3-30 characters.</p>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
              placeholder="Your name (defaults to username)"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Email *</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Password *</label>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
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
            <label className="block text-xs text-white/60 mb-1">Phone (optional)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
              placeholder="+1 (555) 123-4567"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
            <User className="h-4 w-4 text-cyan-400" />
            Connect Sleeper (optional)
          </div>
          <p className="text-xs text-white/40">
            Link your Sleeper account to import your history and show your Sleeper identity.
          </p>
          <div className="flex gap-2">
            <input
              value={sleeperUsername}
              onChange={(e) => {
                setSleeperUsername(e.target.value)
                setSleeperResult(null)
              }}
              className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
              placeholder="Sleeper username"
            />
            <button
              type="button"
              onClick={lookupSleeper}
              disabled={sleeperLooking || !sleeperUsername.trim()}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm hover:bg-white/15 disabled:opacity-50 transition"
            >
              {sleeperLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>

          {sleeperResult?.found && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              {sleeperResult.avatar ? (
                <img src={sleeperResult.avatar} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-white/50" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-emerald-300 truncate">{sleeperResult.displayName}</div>
                <div className="text-xs text-white/40">@{sleeperResult.username}</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            </div>
          )}

          {sleeperResult && !sleeperResult.found && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              <XCircle className="h-4 w-4 shrink-0" />
              Sleeper user not found. Check the username and try again.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-sm text-white/80">
              I confirm that I am 18 years of age or older. *
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !username.trim() || !email.trim() || !password || !ageConfirmed}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </span>
          ) : (
            "Create Account"
          )}
        </button>

        <p className="text-center text-sm text-white/40">
          Already have an account?{" "}
          <Link href="/login" className="text-white/80 hover:text-white hover:underline transition">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
