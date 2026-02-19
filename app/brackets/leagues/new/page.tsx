"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Trophy } from "lucide-react"

export default function NewBracketLeaguePage() {
  const [name, setName] = useState("")
  const [season, setSeason] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function createLeague(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/bracket/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), season, sport: "ncaam" }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.error === "AGE_REQUIRED") {
          router.push("/verify?error=AGE_REQUIRED")
          return
        }
        if (data.error === "VERIFICATION_REQUIRED") {
          router.push("/verify?error=VERIFICATION_REQUIRED")
          return
        }
        setError(data.error ?? "Failed to create league")
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
    <div className="relative min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="absolute top-5 right-5 pointer-events-none select-none z-0">
        <img src="/af-shield-bg.png" alt="" className="w-10 h-10 opacity-[0.06]" draggable={false} />
      </div>
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <Link
          href="/brackets"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Brackets
        </Link>

        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <Trophy className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Create a league</h1>
            <p className="text-sm text-gray-400 mt-1">
              Set up your bracket pool and invite friends to compete.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form
          onSubmit={createLeague}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
        >
          <div>
            <label className="text-sm text-white/70">League name</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-white/20"
              placeholder="e.g. Office Pool 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Season year</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-white/20"
              type="number"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full rounded-xl bg-white text-black px-4 py-3 text-sm font-medium hover:bg-gray-200 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create league"
            )}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center">
          After creating, you&apos;ll get a join code to share with friends.
        </p>
      </div>
    </div>
  )
}
