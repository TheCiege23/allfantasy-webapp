"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useBracketLive } from "@/lib/hooks/useBracketLive"

type Row = { entryId: string; entryName: string; ownerName: string; points: number }

export function Leaderboard({ tournamentId, leagueId }: { tournamentId: string; leagueId: string }) {
  const { data } = useBracketLive({ tournamentId, leagueId, enabled: true, intervalMs: 12000 })

  const standings = (data?.standings ?? []) as Row[]

  const prevRanks = useRef<Map<string, number>>(new Map())
  const [flash, setFlash] = useState<string | null>(null)

  const ranked = useMemo(() => {
    const rows = standings.map((r, idx) => {
      const prev = prevRanks.current.get(r.entryId)
      const change = prev != null ? prev - (idx + 1) : 0
      return { ...r, rank: idx + 1, change }
    })

    const map = new Map<string, number>()
    rows.forEach((r) => map.set(r.entryId, r.rank))
    prevRanks.current = map

    return rows
  }, [standings])

  useEffect(() => {
    if (!ranked.length) return
    setFlash("on")
    const t = setTimeout(() => setFlash(null), 350)
    return () => clearTimeout(t)
  }, [standings])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur p-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-white">Leaderboard</div>
        <div className="text-xs text-gray-300">Live</div>
      </div>

      <div className="mt-3 space-y-2">
        {ranked.map((r) => (
          <div
            key={r.entryId}
            className={[
              "rounded-xl border border-white/10 bg-black/20 p-3 flex items-center justify-between transition",
              flash ? "ring-1 ring-white/10" : "",
            ].join(" ")}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-white">#{r.rank}</div>
                <div className="text-sm text-white truncate">{r.entryName}</div>
                {r.change !== 0 && (
                  <span className={["text-[11px] px-2 py-0.5 rounded-full",
                    r.change > 0 ? "bg-green-500/20 text-green-200" : "bg-red-500/20 text-red-200"
                  ].join(" ")}>
                    {r.change > 0 ? `\u25B2${r.change}` : `\u25BC${Math.abs(r.change)}`}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-300 truncate">{r.ownerName}</div>
            </div>

            <div className="text-sm font-semibold text-white tabular-nums">{r.points}</div>
          </div>
        ))}

        {ranked.length === 0 && (
          <div className="text-sm text-gray-300">No entries yet.</div>
        )}
      </div>
    </div>
  )
}
