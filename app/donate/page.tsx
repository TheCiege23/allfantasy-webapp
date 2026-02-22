"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const PRESET_AMOUNTS = [5, 10, 25, 50]

export default function DonatePage() {
  const router = useRouter()
  const [amount, setAmount] = useState<number>(10)
  const [custom, setCustom] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalAmount = useCustom ? Number(custom) : amount

  async function handleDonate() {
    if (!finalAmount || finalAmount < 1 || finalAmount > 500) {
      setError("Please enter an amount between $1 and $500.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "donate", amount: finalAmount, currency: "usd" }),
      })

      const data = await res.json()

      if (!res.ok || !data.url) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }

      window.location.href = data.url
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-white/50 hover:text-white/80 transition"
        >
          &larr; Back
        </button>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Support AllFantasy</h1>
            <p className="mt-1 text-sm text-white/60">
              Brackets are always free. Your support helps cover servers, data feeds, and development costs.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">
              Choose an amount
            </p>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setUseCustom(false) }}
                  className={`rounded-lg border py-2 text-sm font-semibold transition ${
                    !useCustom && amount === a
                      ? "border-blue-500 bg-blue-500/20 text-blue-400"
                      : "border-white/10 bg-slate-800/50 text-white/70 hover:border-white/30"
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={() => setUseCustom(!useCustom)}
              className="text-xs text-blue-400 hover:text-blue-300 transition"
            >
              {useCustom ? "Use preset amount" : "Enter custom amount"}
            </button>
            {useCustom && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-white/50">$</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  placeholder="Enter amount"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={handleDonate}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Redirecting to checkout..." : `Donate $${finalAmount || "..."}`}
          </button>

          <p className="text-[11px] text-white/40 text-center">
            Processed securely via Stripe. No account required.
          </p>
        </div>
      </div>
    </div>
  )
}
