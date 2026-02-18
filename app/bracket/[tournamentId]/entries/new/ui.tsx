"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Trophy, Plus } from "lucide-react"

type League = {
  id: string
  name: string
  joinCode: string
  ownerId: string
  tournamentId: string
  _count: { entries: number; members: number }
}

export default function CreateEntryChooser({
  tournamentId,
  leagues,
  userId,
}: {
  tournamentId: string
  leagues: League[]
  userId: string
}) {
  const router = useRouter()
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(
    leagues.length === 1 ? leagues[0].id : ""
  )
  const [entryName, setEntryName] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const selectedLeague = useMemo(
    () => leagues.find((l) => l.id === selectedLeagueId) || null,
    [leagues, selectedLeagueId]
  )

  async function createEntry() {
    if (!selectedLeagueId || !entryName.trim()) return
    setLoading(true)
    setErr(null)

    try {
      const res = await fetch("/api/bracket/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagueId: selectedLeagueId, name: entryName.trim() }),
      })

      const data = await res.json().catch(() => ({}))
      setLoading(false)

      if (!res.ok) {
        setErr(data?.error || "Failed to create entry")
        return
      }

      router.push(`/bracket/${tournamentId}/entry/${data.entryId}`)
    } catch {
      setLoading(false)
      setErr("Something went wrong. Please try again.")
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
            <p className="text-sm text-white/50">
              Pick a league and name your entry.
            </p>
          </div>
        </div>

        {err && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {err}
          </div>
        )}

        {leagues.length === 0 ? (
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">League</label>
              {leagues.length === 1 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <div className="font-medium">{leagues[0].name}</div>
                  <div className="text-xs text-white/40 mt-1">
                    {leagues[0]._count.members} member{leagues[0]._count.members !== 1 ? "s" : ""}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {leagues.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedLeagueId(l.id)}
                      className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                        selectedLeagueId === l.id
                          ? "border-cyan-500 bg-cyan-500/10 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-white/40 mt-1">
                        {l._count.members} member{l._count.members !== 1 ? "s" : ""} &middot; {l._count.entries} entr{l._count.entries !== 1 ? "ies" : "y"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedLeague && (
              <div className="text-xs text-white/40">
                Join code: <span className="font-mono text-white/60">{selectedLeague.joinCode}</span>
              </div>
            )}

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
              disabled={!selectedLeagueId || !entryName.trim() || loading}
              onClick={createEntry}
              className="w-full rounded-xl bg-white text-black py-3 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create entry"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
