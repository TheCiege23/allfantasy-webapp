"use client"

import { useState } from "react"

type Rec = {
  nodeId: string
  matchup: string
  round: number
  safePick: string | null
  upsetPick: string | null
  safeConfidence: number
  insight: string
}

export function PickAssistCard({ entryId }: { entryId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recs, setRecs] = useState<Rec[]>([])

  async function runAssist() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/bracket/ai-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Failed to load AI assist")
        return
      }
      setRecs(data.recommendations || [])
    } catch {
      setError("Failed to load AI assist")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-cyan-200">AI Pick Assist</div>
        <button onClick={runAssist} disabled={loading} className="text-xs rounded-md bg-cyan-400 text-black px-2 py-1 font-medium">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <div className="text-xs text-red-300">{error}</div>}
      {recs.length === 0 ? (
        <div className="text-xs text-gray-300">Get matchup-aware pick suggestions based on seed value and bracket leverage.</div>
      ) : (
        <div className="space-y-2">
          {recs.slice(0, 4).map((r) => (
            <div key={r.nodeId} className="rounded-xl border border-white/10 bg-black/20 p-2">
              <div className="text-xs text-gray-400">Round {r.round} • {r.matchup}</div>
              <div className="text-sm text-white">Safe: <span className="text-cyan-200">{r.safePick || "TBD"}</span> ({r.safeConfidence}%)</div>
              <div className="text-xs text-gray-300">Upset dart: {r.upsetPick || "TBD"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
