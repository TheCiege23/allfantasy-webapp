"use client"

import { useState } from "react"

export default function ConfirmPaymentButton({ leagueId }: { leagueId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bracket/leagues/${leagueId}/confirm-payment`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Failed to confirm payment")
        return
      }
      setDone(true)
      window.location.reload()
    } catch {
      setError("Failed to confirm payment")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onConfirm}
        disabled={loading || done}
        className="rounded-lg bg-emerald-500 text-black px-3 py-1.5 text-sm font-medium hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? "Confirming..." : done ? "Payment Confirmed" : "Confirm FanCred Payment"}
      </button>
      {error && <div className="text-xs text-red-300">{error}</div>}
    </div>
  )
}
