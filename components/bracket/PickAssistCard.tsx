"use client"

import { useState } from "react"

export function PickAssistCard({ entryId }: { entryId: string }) {
  const [loading, setLoading] = useState(false)
  const [tips, setTips] = useState<{ team: string; edge: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchAssist() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/bracket/pick-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      })
      if (!res.ok) {
        const msg = await res.json().catch(() => ({ error: "Request failed" }))
        setError(msg.error || "Failed to load pick assist")
        return
      }
      const data = await res.json()
      setTips(data.tips ?? [])
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/80">AI Pick Assist</h3>
        <button
          onClick={fetchAssist}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition"
        >
          {loading ? "Analyzing…" : tips ? "Refresh" : "Get Tips"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {tips && tips.length === 0 && (
        <p className="text-xs text-white/40">No tips available for remaining games.</p>
      )}

      {tips && tips.length > 0 && (
        <ul className="space-y-2">
          {tips.map((t, i) => (
            <li key={i} className="text-xs text-white/70">
              <span className="font-medium text-white/90">{t.team}</span>{" "}
              — {t.edge}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
