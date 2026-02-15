"use client"

import React, { useEffect, useState } from "react"
import { apiGet } from "@/lib/api"

function MetricRow(props: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm text-gray-300">
      <span>{props.label}</span>
      <span className="font-semibold">{props.value ?? "\u2014"}</span>
    </div>
  )
}

export function DriftDashboard(props: { leagueId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setError(null)
        const data = await apiGet<{ rows: any[] }>(`/api/leagues/${encodeURIComponent(props.leagueId)}/v3/drift?days=60`)
        if (!cancelled) setRows(data.rows ?? [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load drift")
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [props.leagueId])

  const latest = rows.length ? rows[rows.length - 1] : null

  return (
    <div className="rounded-2xl bg-zinc-950 border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white">Drift Monitoring</h2>
        <span className="text-xs text-gray-500">last 60 days</span>
      </div>

      {error ? <div className="text-sm text-red-400">Error: {error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-900 p-4">
          <div className="font-bold text-white mb-2">Latest</div>
          <div className="space-y-1">
            <MetricRow label="ECE" value={latest?.ece} />
            <MetricRow label="Brier" value={latest?.brier} />
            <MetricRow label="AUC" value={latest?.auc} />
            <MetricRow label="PSI" value={latest?.psiJson ? "see raw" : "\u2014"} />
            <MetricRow label="Narrative fail rate" value={latest?.narrativeFailRate} />
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900 p-4">
          <div className="font-bold text-white mb-2">Series (raw)</div>
          <div className="text-xs text-gray-500 mb-2">Hook this into charts later (Recharts) once you confirm fields.</div>
          <div className="max-h-56 overflow-auto text-xs">
            {rows.slice(-20).map((r, i) => (
              <div key={i} className="flex justify-between border-b border-zinc-800 py-1 text-gray-400">
                <span>{String(r.day).slice(0, 10)}</span>
                <span>ECE {r.ece ?? "\u2014"} &bull; Brier {r.brier ?? "\u2014"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
