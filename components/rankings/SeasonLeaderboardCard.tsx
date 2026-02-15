"use client"
import React from "react"

export function SeasonLeaderboardCard(props: { season: string; rows: any[] }) {
  if (!props.rows?.length) return null

  return (
    <div className="rounded-2xl bg-zinc-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Season leaderboard</h2>
        <span className="text-xs opacity-70">{props.season}</span>
      </div>

      <div className="space-y-2">
        {props.rows.slice(0, 12).map((r, idx) => (
          <div key={`${r.rosterId}-${idx}`} className="rounded-xl bg-zinc-900 p-3 flex justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70 w-6">#{idx + 1}</span>
              <span className="font-semibold">Roster {String(r.rosterId)}</span>
              {r.champion ? <span className="text-xs">🏆</span> : null}
            </div>
            <div className="text-xs opacity-80 flex items-center gap-3">
              <span>W {r.wins ?? "—"}</span>
              <span>L {r.losses ?? "—"}</span>
              <span>PF {r.pointsFor ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
