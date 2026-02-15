"use client"
import React from "react"

export function DraftGradesCard(props: { rows: any[] }) {
  if (!props.rows?.length) return null

  return (
    <div className="rounded-2xl bg-zinc-950 border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white">Draft Grades</h2>
        <span className="text-xs text-gray-500">post-draft</span>
      </div>

      <div className="space-y-2">
        {props.rows.slice(0, 12).map((r) => (
          <div key={String(r.rosterId)} className="rounded-xl bg-zinc-900 p-3 flex justify-between items-center">
            <div className="font-semibold text-white">Roster {String(r.rosterId)}</div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-400">{Number(r.score)}</div>
              <div className="px-2 py-1 rounded-full bg-zinc-800 text-xs font-bold text-white">{String(r.grade)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
