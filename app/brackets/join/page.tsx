"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Users } from "lucide-react"

function JoinLeagueForm() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const sp = useSearchParams()

  useEffect(() => {
    const c = sp.get("code")
    if (c) setCode(c.toUpperCase())
  }, [sp])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/bracket/leagues/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ joinCode: code.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "AGE_REQUIRED") {
          router.push("/verify?error=AGE_REQUIRED")
          return
        }
        if (data.error === "VERIFICATION_REQUIRED") {
          router.push("/verify?error=VERIFICATION_REQUIRED")
          return
        }
        setError(data.error ?? "Failed to join pool")
        return
      }
      router.push(`/brackets/leagues/${data.leagueId}`)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="text-xs font-semibold" style={{ color: '#fb923c' }}>Invite Code</label>
          <input
            className="mt-2 w-full bg-transparent border-b-2 pb-2 text-2xl outline-none uppercase tracking-[0.3em] text-center font-mono"
            style={{ borderColor: '#fb923c', color: 'white' }}
            placeholder="ABCD1234"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            disabled={loading}
            autoFocus
          />
          <p className="text-xs mt-2 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Enter the invite code your friend shared with you.
          </p>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 sm:static sm:p-0">
          <button
            type="submit"
            disabled={!code.trim() || loading}
            className="w-full rounded-xl px-4 py-3.5 text-sm font-bold uppercase tracking-wider text-black disabled:opacity-40 transition"
            style={{ background: '#fb923c' }}
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining...
              </span>
            ) : (
              "JOIN POOL"
            )}
          </button>
        </div>
      </form>
    </>
  )
}

function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-2 text-sm transition"
      style={{ color: 'rgba(255,255,255,0.5)' }}
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  )
}

export default function JoinLeaguePage() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#0d1117' }}>
      <div className="p-4 sm:p-6 max-w-md mx-auto space-y-6">
        <BackButton />

        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.12)' }}>
            <Users className="w-6 h-6" style={{ color: '#fb923c' }} />
          </div>
          <h1 className="text-xl font-bold">Join a Pool</h1>
        </div>

        <Suspense fallback={<div className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</div>}>
          <JoinLeagueForm />
        </Suspense>
      </div>
    </div>
  )
}
