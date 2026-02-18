"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Users } from "lucide-react"

function JoinLeagueForm() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const sp = useSearchParams()

  useEffect(() => {
    const c = sp.get("code")
    if (c) setCode(c.toUpperCase())
  }, [sp])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/bracket/leagues/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ joinCode: code.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "AGE_REQUIRED" || data.error === "VERIFICATION_REQUIRED") {
          router.push("/onboarding")
          return
        }
        setError(data.error ?? "Failed to join league")
        return
      }
      router.push(`/brackets/leagues/${data.leagueId}`)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={handleJoin}
        className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
      >
        <div>
          <label className="text-sm text-white/70">Invite code</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-white/20 uppercase tracking-widest text-center font-mono text-lg"
            placeholder="ABCD1234"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={12}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={!code.trim() || loading}
          className="w-full rounded-xl bg-white text-black px-4 py-3 text-sm font-medium hover:bg-gray-200 disabled:opacity-60 transition-colors"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining...
            </span>
          ) : (
            "Join league"
          )}
        </button>
      </form>
    </>
  )
}

export default function JoinLeaguePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-md mx-auto space-y-4">
        <Link
          href="/brackets"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Brackets
        </Link>

        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <Users className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Join a league</h1>
            <p className="text-sm text-gray-400 mt-1">
              Enter the invite code your friend shared with you.
            </p>
          </div>
        </div>

        <Suspense fallback={<div className="text-sm text-gray-400">Loading...</div>}>
          <JoinLeagueForm />
        </Suspense>
      </div>
    </div>
  )
}
