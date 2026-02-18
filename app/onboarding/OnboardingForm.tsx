"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function OnboardingForm({
  defaultName,
  defaultPhone,
  isVerified = false,
}: {
  defaultName: string
  defaultPhone: string
  isVerified?: boolean
}) {
  const [displayName, setDisplayName] = useState(defaultName)
  const [phone, setPhone] = useState(defaultPhone)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function submit() {
    if (!displayName.trim()) {
      setError("Display name is required.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), phone: phone.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Something went wrong.")
        setLoading(false)
        return
      }

      router.push("/dashboard")
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-400 mb-1">Display name</label>
        <input
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Phone (optional)</label>
        <input
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 transition"
          placeholder="+1 (555) 123-4567"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <button
        onClick={submit}
        disabled={!displayName.trim() || loading || !isVerified}
        className="w-full rounded-xl bg-white text-black px-3 py-2.5 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60 transition-colors"
      >
        {loading ? "Saving..." : !isVerified ? "Verify email first" : "Complete profile"}
      </button>
    </div>
  )
}
