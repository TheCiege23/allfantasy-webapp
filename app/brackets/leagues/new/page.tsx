"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Globe, Lock } from "lucide-react"

export default function NewBracketLeaguePage() {
  const [name, setName] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAgeConfirm, setShowAgeConfirm] = useState(false)
  const [ageConfirming, setAgeConfirming] = useState(false)
  const router = useRouter()

  async function handleConfirmAge() {
    setAgeConfirming(true)
    try {
      const res = await fetch("/api/auth/confirm-age", { method: "POST" })
      if (res.ok) {
        setShowAgeConfirm(false)
        setError(null)
        setTimeout(() => submitPool(), 500)
      } else {
        setError("Failed to confirm age. Please try again.")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setAgeConfirming(false)
    }
  }

  async function submitPool() {
    setError(null)
    setShowAgeConfirm(false)
    setLoading(true)

    try {
      const res = await fetch("/api/bracket/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          season: new Date().getFullYear(),
          sport: "ncaam",
          maxManagers: 100,
          isPublic,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.error === "AGE_REQUIRED") {
          setShowAgeConfirm(true)
          return
        }
        if (data.error === "VERIFICATION_REQUIRED") {
          setError("Please verify your email first before creating a pool.")
          return
        }
        setError(data.error ?? "Failed to create pool")
        return
      }
      router.push(`/brackets/leagues/${data.leagueId}`)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function createPool(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await submitPool()
  }

  return (
    <div className="min-h-screen text-white" style={{ background: '#0d1117' }}>
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm mb-8 transition"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <h1 className="text-xl font-bold text-center mb-8">Name your pool</h1>

        <form onSubmit={createPool} className="space-y-6">
          <div>
            <label className="text-xs font-semibold" style={{ color: '#fb923c' }}>Pool Name</label>
            <input
              className="mt-2 w-full bg-transparent border-b-2 pb-2 text-lg outline-none transition"
              style={{ borderColor: '#fb923c', color: 'white' }}
              placeholder="Madness"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Don&apos;t worry. You will be able to change this later.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold" style={{ color: '#fb923c' }}>Pool Visibility</label>
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className="flex-1 flex items-center gap-3 rounded-xl p-3.5 transition"
                style={{
                  background: !isPublic ? 'rgba(251,146,60,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${!isPublic ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <Lock className="w-5 h-5 flex-shrink-0" style={{ color: !isPublic ? '#fb923c' : 'rgba(255,255,255,0.25)' }} />
                <div className="text-left">
                  <div className="text-sm font-semibold" style={{ color: !isPublic ? 'white' : 'rgba(255,255,255,0.4)' }}>Private</div>
                  <div className="text-[10px] mt-0.5" style={{ color: !isPublic ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
                    Invite only via code
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className="flex-1 flex items-center gap-3 rounded-xl p-3.5 transition"
                style={{
                  background: isPublic ? 'rgba(251,146,60,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${isPublic ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <Globe className="w-5 h-5 flex-shrink-0" style={{ color: isPublic ? '#fb923c' : 'rgba(255,255,255,0.25)' }} />
                <div className="text-left">
                  <div className="text-sm font-semibold" style={{ color: isPublic ? 'white' : 'rgba(255,255,255,0.4)' }}>Public</div>
                  <div className="text-[10px] mt-0.5" style={{ color: isPublic ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
                    Anyone can find &amp; join
                  </div>
                </div>
              </button>
            </div>
          </div>

          {showAgeConfirm && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)' }}>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                You must confirm you are 18 or older to create a bracket pool.
              </p>
              <button
                type="button"
                onClick={handleConfirmAge}
                disabled={ageConfirming}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50 transition"
                style={{ background: '#fb923c' }}
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

          {error && (
            <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 p-4 sm:static sm:p-0">
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="w-full rounded-xl px-4 py-3.5 text-sm font-bold uppercase tracking-wider text-black disabled:opacity-40 transition"
              style={{ background: '#fb923c' }}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                "NEXT"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
