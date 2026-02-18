"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Trophy, Plus } from "lucide-react"

type League = {
  id: string
  name: string
  joinCode: string
  memberCount: number
}

export default function NewEntryPage() {
  const params = useParams()
  const router = useRouter()
  const tournamentId = params?.tournamentId as string

  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null)
  const [entryName, setEntryName] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLeagues() {
      try {
        const res = await fetch(`/api/bracket/leagues?tournamentId=${tournamentId}`)
        if (res.status === 401) {
          router.push("/login")
          return
        }
        const data = await res.json()
        if (res.ok) {
          setLeagues(data.leagues ?? [])
          if (data.leagues?.length === 1) {
            setSelectedLeague(data.leagues[0].id)
          }
        }
      } catch {
        setError("Failed to load your leagues")
      } finally {
        setLoading(false)
      }
    }
    fetchLeagues()
  }, [tournamentId, router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLeague || !entryName.trim()) return
    setError(null)
    setCreating(true)

    try {
      const res = await fetch("/api/bracket/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagueId: selectedLeague, name: entryName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "AGE_REQUIRED" || data.error === "VERIFICATION_REQUIRED") {
          router.push("/onboarding")
          return
        }
        setError(data.error ?? "Failed to create entry")
        return
      }
      router.push(`/bracket/${data.tournamentId}/entry/${data.entryId}`)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-xl mx-auto space-y-6">
        <Link
          href="/brackets"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Brackets
        </Link>

        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-yellow-400" />
          <div>
            <h1 className="text-xl font-bold">Create a bracket entry</h1>
            <p className="text-sm text-white/50">Pick a league and name your entry.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : leagues.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center space-y-3">
            <p className="text-sm text-gray-400">
              You need to join or create a league before making a bracket entry.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/brackets/leagues/new"
                className="inline-flex items-center gap-2 rounded-lg bg-white text-black px-4 py-2 text-sm font-medium hover:bg-gray-200 transition"
              >
                <Plus className="h-4 w-4" />
                Create League
              </Link>
              <Link
                href="/brackets/join"
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm hover:bg-gray-800 transition"
              >
                Join League
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">League</label>
              {leagues.length === 1 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  {leagues[0].name}
                </div>
              ) : (
                <div className="space-y-2">
                  {leagues.map((lg) => (
                    <button
                      key={lg.id}
                      type="button"
                      onClick={() => setSelectedLeague(lg.id)}
                      className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                        selectedLeague === lg.id
                          ? "border-cyan-500 bg-cyan-500/10 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <div className="font-medium">{lg.name}</div>
                      <div className="text-xs text-white/40 mt-1">{lg.memberCount} member{lg.memberCount !== 1 ? "s" : ""}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Entry name</label>
              <input
                type="text"
                value={entryName}
                onChange={(e) => setEntryName(e.target.value)}
                placeholder="e.g. My Bracket"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500"
                maxLength={50}
              />
            </div>

            <button
              type="submit"
              disabled={creating || !selectedLeague || !entryName.trim()}
              className="w-full rounded-xl bg-white text-black py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition"
            >
              {creating ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create entry"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
