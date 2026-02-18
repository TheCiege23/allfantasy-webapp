"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const [error, setError] = useState("")

  async function submit() {
    setLoading(true)
    setError("")

    try {
      const preRes = await fetch("/api/auth/pre-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, displayName, phone }),
      })

      if (!preRes.ok) {
        const data = await preRes.json().catch(() => ({}))
        setError(data.error || "Something went wrong. Please try again.")
        setLoading(false)
        return
      }

      const result = await signIn("email", {
        email,
        callbackUrl: "/onboarding",
        redirect: false,
      })

      if (result?.error) {
        setError("Failed to send sign-in link. Please check your email and try again.")
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-md mx-auto space-y-4">
        <Link
          href="/brackets"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
        >
          &larr; Back to Brackets
        </Link>

        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-white/60">
          Enter your info below. You'll confirm via a magic link sent to your email.
        </p>

        {sent ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
            <div className="text-lg font-semibold text-emerald-300">Check your email</div>
            <p className="text-sm text-white/60">
              We sent a sign-in link to <span className="font-medium text-white">{email}</span>.
              Click it to complete signup.
            </p>
          </div>
        ) : (
          <>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Display name</label>
              <input
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phone (optional)</label>
              <input
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
                placeholder="+1 (555) 123-4567"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <button
              onClick={submit}
              disabled={!email || !displayName || loading}
              className="w-full rounded-xl bg-white text-black px-3 py-2.5 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60 transition-colors"
            >
              {loading ? "Sending link..." : "Sign up"}
            </button>
          </div>
          </>
        )}

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login?callbackUrl=/brackets" className="text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
