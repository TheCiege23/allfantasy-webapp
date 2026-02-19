"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, X } from "lucide-react"

export default function CreateEntryButton({
  leagueId,
}: {
  leagueId: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
        if (data.error === "PAYMENT_REQUIRED_FOR_EXTRA_ENTRIES") {
          setError(data.message || "3+ brackets require payment confirmation by the commissioner.")
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white text-black px-3 py-1.5 text-sm font-medium hover:bg-gray-200 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Create entry
      </button>
    )
  }

  return (
    <div className="w-full mt-3">
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
          className="rounded-lg bg-white text-black px-3 py-1.5 text-sm font-medium hover:bg-gray-200 disabled:opacity-60 transition-colors"
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
      {error && (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      )}
    </div>
  )
}
