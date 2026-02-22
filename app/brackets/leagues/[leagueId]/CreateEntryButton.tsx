"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, X, CreditCard, Lock, Unlock } from "lucide-react"

type PaymentStatus = {
  isPaidLeague: boolean
  hasPaidFirstBracket: boolean
  hasUnlimitedUnlock: boolean
  bracketCount: number
  freeLimit: number
}

export default function CreateEntryButton({
  leagueId,
}: {
  leagueId: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/bracket/stripe/payment-status?leagueId=${leagueId}`)
      .then(r => r.json())
      .then(setPaymentStatus)
      .catch(() => {})
  }, [leagueId])

  async function handleCheckout(paymentType: string) {
    setCheckingOut(true)
    setError(null)
    try {
      const res = await fetch("/api/bracket/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagueId, paymentType }),
      })
      const data = await res.json()
      if (data.alreadyPaid) {
        setPaymentStatus(prev => prev ? {
          ...prev,
          ...(paymentType === "first_bracket_fee" ? { hasPaidFirstBracket: true } : { hasUnlimitedUnlock: true }),
        } : prev)
        return
      }
      if (!res.ok) {
        setError(data.error || "Checkout failed")
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setCheckingOut(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/bracket/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagueId, name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "PAYMENT_REQUIRED") {
          setError(data.message || "Payment required")
          return
        }
        setError(data.error ?? "Failed to create entry")
        return
      }
      router.push(`/bracket/${data.tournamentId}/entry/${data.entryId}`)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const needsFirstPayment = paymentStatus?.isPaidLeague && !paymentStatus?.hasPaidFirstBracket
  const needsUnlimitedUnlock = paymentStatus?.isPaidLeague && paymentStatus?.hasPaidFirstBracket && !paymentStatus?.hasUnlimitedUnlock && (paymentStatus?.bracketCount || 0) >= 3

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ background: 'white', color: 'black' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create bracket
        </button>

        {paymentStatus?.isPaidLeague && (
          <div className="text-[10px] space-y-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {!paymentStatus.hasPaidFirstBracket && (
              <div className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>$2 hosting fee required for first bracket</span>
              </div>
            )}
            {paymentStatus.hasPaidFirstBracket && !paymentStatus.hasUnlimitedUnlock && (
              <div>
                {paymentStatus.bracketCount}/3 brackets used
                {paymentStatus.bracketCount >= 3 && " · Unlock unlimited for $3"}
              </div>
            )}
            {paymentStatus.hasUnlimitedUnlock && (
              <div className="flex items-center gap-1" style={{ color: 'rgba(16,185,129,0.6)' }}>
                <Unlock className="w-3 h-3" />
                <span>Unlimited brackets unlocked</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full mt-3 space-y-3">
      {needsFirstPayment && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)' }}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" style={{ color: '#fb923c' }} />
            <span className="text-sm font-semibold" style={{ color: '#fb923c' }}>Paid League</span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            This is a paid bracket league. A one-time $2 hosting convenience fee is required to create your first bracket.
          </p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Includes 3 brackets. Unlock unlimited brackets for $3.
          </p>
          <button
            onClick={() => handleCheckout("first_bracket_fee")}
            disabled={checkingOut}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition-all"
            style={{ background: '#fb923c', color: 'black' }}
          >
            {checkingOut ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              "Pay $2 Hosting Fee"
            )}
          </button>
        </div>
      )}

      {needsUnlimitedUnlock && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
        >
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4" style={{ color: '#a78bfa' }} />
            <span className="text-sm font-semibold" style={{ color: '#a78bfa' }}>Unlock Unlimited</span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            You&apos;ve used all 3 included brackets. Upgrade to unlimited brackets for just $3.
          </p>
          <button
            onClick={() => handleCheckout("unlimited_unlock")}
            disabled={checkingOut}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition-all"
            style={{ background: '#a78bfa', color: 'black' }}
          >
            {checkingOut ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              "Unlock Unlimited for $3"
            )}
          </button>
        </div>
      )}

      {!needsFirstPayment && (
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Bracket"
            disabled={loading}
            className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm outline-none focus:border-white/20"
          />
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 transition-colors"
            style={{ background: 'white', color: 'black' }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Create"
            )}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); setName("") }}
            className="rounded-lg border border-white/10 p-1.5 hover:bg-white/10 transition"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>
        </form>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      )}
    </div>
  )
}
