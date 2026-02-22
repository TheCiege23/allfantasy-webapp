"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Heart } from "lucide-react"
import { useState } from "react"

function DonateButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState(500)
  const [customAmount, setCustomAmount] = useState("")

  const presets = [
    { label: "$3", value: 300 },
    { label: "$5", value: 500 },
    { label: "$10", value: 1000 },
  ]

  async function handleDonate() {
    const amount = customAmount ? Math.round(parseFloat(customAmount) * 100) : selectedAmount
    if (!amount || amount < 100) return
    setLoading(true)
    try {
      const res = await fetch("/api/bracket/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: amount }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {}
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition hover:opacity-90"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}
      >
        <Heart className="w-3.5 h-3.5" />
        Support
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="rounded-2xl p-6 w-full max-w-sm space-y-4 mx-4"
        style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <Heart className="w-6 h-6" style={{ color: '#f87171' }} />
          </div>
          <h3 className="text-lg font-bold text-white">Support FanCred Brackets</h3>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            All brackets are free. Your donation helps keep it that way.
          </p>
        </div>

        <div className="flex gap-2">
          {presets.map(p => (
            <button
              key={p.value}
              onClick={() => { setSelectedAmount(p.value); setCustomAmount("") }}
              className="flex-1 rounded-xl py-3 text-sm font-bold transition"
              style={{
                background: !customAmount && selectedAmount === p.value ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${!customAmount && selectedAmount === p.value ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.06)'}`,
                color: !customAmount && selectedAmount === p.value ? '#fb923c' : 'rgba(255,255,255,0.6)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div>
          <input
            type="number"
            min="1"
            max="500"
            step="0.01"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Custom amount ($)"
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder-white/20"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>

        <button
          onClick={handleDonate}
          disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-50"
          style={{ background: '#fb923c', color: 'black' }}
        >
          {loading ? "Processing..." : `Donate ${customAmount ? `$${customAmount}` : `$${(selectedAmount / 100).toFixed(0)}`}`}
        </button>

        <button
          onClick={() => setOpen(false)}
          className="w-full text-center text-xs py-1 transition"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}

export function BracketsNavLinks() {
  const pathname = usePathname()
  const active = (p: string) => pathname.startsWith(p)

  const isMarch = (() => {
    const m = new Date().getMonth()
    return m === 2 || m === 3
  })()

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/brackets"
        className={[
          "px-3 py-2 rounded-xl text-sm font-medium transition",
          active("/brackets") ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/10 hover:text-white",
        ].join(" ")}
      >
        Brackets
      </Link>

      {isMarch && (
        <Link
          href="/brackets"
          className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow hover:opacity-95 transition"
        >
          <span>🏀</span> Bracket Challenge <span className="text-[11px] bg-orange-500 px-2 py-0.5 rounded-full">LIVE</span>
        </Link>
      )}

      <DonateButton />
    </div>
  )
}
