"use client"
import React from "react"

export function HallOfFameCard(props: { rows: any[] }) {
  if (!props.rows?.length) return null

  return (
    <div className="rounded-2xl bg-zinc-950 border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white">Hall of Fame</h2>
        <span className="text-xs text-gray-500">all-time</span>
      </div>

      <div className="space-y-2">
        {props.rows.slice(0, 12).map((r, idx) => (
          <div key={String(r.rosterId)} className="rounded-xl bg-zinc-900 p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-6">#{idx + 1}</span>
              <span className="font-semibold text-white">Roster {String(r.rosterId)}</span>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-3">
              <span>{Number(r.championships)} titles</span>
              <span>{Number(r.seasonsPlayed)} seasons</span>
              <span className="font-bold text-white">{Number(r.score).toFixed(3)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
