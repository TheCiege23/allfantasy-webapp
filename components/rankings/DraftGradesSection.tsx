"use client"

import React, { useState } from "react"
import { useDraftGrades } from "@/hooks/useDraftGrades"
import { DraftGradesCard } from "@/components/DraftGradesCard"

export function DraftGradesSection(props: { leagueId: string; season: string; defaultWeek: number }) {
  const { rows, loading, error, computeAndPersist } = useDraftGrades({
    leagueId: props.leagueId,
    season: props.season
  })

  const [week, setWeek] = useState<number>(props.defaultWeek)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-zinc-900 p-4 flex items-center justify-between">
        <div>
          <div className="font-bold">Draft grades</div>
          <div className="text-xs opacity-70">Season {props.season} • computed in post_draft phase</div>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="w-24 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm"
            type="number"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          />
          <button
            className="rounded-xl bg-white text-black px-4 py-2 font-bold disabled:opacity-60"
            disabled={loading}
            onClick={() => computeAndPersist(week)}
          >
            Compute
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl bg-zinc-950 p-3 text-sm opacity-80">Note: {error}</div> : null}

      <DraftGradesCard rows={rows} />
    </div>
  )
}
