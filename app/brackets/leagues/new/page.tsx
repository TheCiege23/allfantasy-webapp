"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Trophy, AlertTriangle, CheckCircle2 } from "lucide-react"

export default function NewBracketLeaguePage() {
  const [name, setName] = useState("")
  const [season, setSeason] = useState(new Date().getFullYear())
  const [maxManagers, setMaxManagers] = useState(100)
  const [isPaidLeague, setIsPaidLeague] = useState(false)
  const [fancredEntryFee, setFancredEntryFee] = useState(0)
  const [fancredPaymentReference, setFancredPaymentReference] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAgeConfirm, setShowAgeConfirm] = useState(false)
  const [ageConfirming, setAgeConfirming] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [showVerificationRequired, setShowVerificationRequired] = useState(false)
  const router = useRouter()

  async function handleConfirmAge() {
    setAgeConfirming(true)
    try {
      const res = await fetch("/api/auth/confirm-age", { method: "POST" })
      if (res.ok) {
        setAgeConfirmed(true)
        setShowAgeConfirm(false)
        setError(null)
        setTimeout(() => submitLeague(), 500)
      } else {
        setError("Failed to confirm age. Please try again.")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setAgeConfirming(false)
    }
  }

  async function submitLeague() {
    setError(null)
    setShowAgeConfirm(false)
    setShowVerificationRequired(false)
    setLoading(true)

    try {
      const res = await fetch("/api/bracket/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          season,
          sport: "ncaam",
          maxManagers,
          isPaidLeague,
          fancredEntryFee,
          fancredPaymentReference,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.error === "AGE_REQUIRED") {
          setShowAgeConfirm(true)
          return
        }
        if (data.error === "VERIFICATION_REQUIRED") {
          setShowVerificationRequired(true)
          return
        }
        setError(data.error ?? "Failed to create league")
        return
      }
      router.push(`/brackets/leagues/${data.leagueId}`)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function createLeague(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await submitLeague()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <Link
          href="/brackets"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Brackets
        </Link>

        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <Trophy className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Create a league</h1>
            <p className="text-sm text-gray-400 mt-1">
              Set up your bracket pool and invite friends to compete.
            </p>
          </div>
        </div>

        {ageConfirmed && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Age confirmed! You can now create your league.
            </div>
          </div>
        )}

        {showAgeConfirm && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-amber-200">Age confirmation required</div>
                <p className="text-sm text-white/60 mt-1">
                  You must confirm you are 18 or older to create a bracket league.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirmAge}
              disabled={ageConfirming}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 transition"
            >
              {ageConfirming ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirming...
                </span>
              ) : (
                "I confirm I am 18 or older"
              )}
            </button>
          </div>
        )}

        {showVerificationRequired && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-cyan-200">Email verification required</div>
                <p className="text-sm text-white/60 mt-1">
                  Please verify your email or phone number before creating a league.
                </p>
              </div>
            </div>
            <Link
              href="/verify"
              className="block w-full text-center rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-purple-500 transition"
            >
              Go to verification
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form
          onSubmit={createLeague}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
        >
          <div>
            <label className="text-sm text-white/70">League name</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-white/20"
              placeholder="e.g. Office Pool 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Season year</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-white/20"
              type="number"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Max managers (up to 1,000)</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-white/20"
              type="number"
              min={2}
              max={1000}
              value={maxManagers}
              onChange={(e) => setMaxManagers(Math.min(1000, Math.max(2, Number(e.target.value) || 2)))}
              disabled={loading}
            />
          </div>

          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
            <span className="text-white/80">Paid league via FanCred</span>
            <input
              type="checkbox"
              checked={isPaidLeague}
              onChange={(e) => setIsPaidLeague(e.target.checked)}
              disabled={loading}
            />
          </label>

          {isPaidLeague && (
            <>
              <div>
                <label className="text-sm text-white/70">FanCred entry fee (USD)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-white/20"
                  type="number"
                  min={0}
                  step={1}
                  value={fancredEntryFee}
                  onChange={(e) => setFancredEntryFee(Math.max(0, Number(e.target.value) || 0))}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-sm text-white/70">FanCred payment reference (optional)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-white/20"
                  value={fancredPaymentReference}
                  onChange={(e) => setFancredPaymentReference(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. FC-2026-LEAGUE-001"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full rounded-xl bg-white text-black px-4 py-3 text-sm font-medium hover:bg-gray-200 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create league"
            )}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center">
          After creating, you&apos;ll get a join code to share with friends.
        </p>
      </div>
    </div>
  )
}
