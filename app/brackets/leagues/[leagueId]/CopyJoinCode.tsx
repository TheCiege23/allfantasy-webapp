"use client"

import { useState } from "react"
import { Copy, Check, Link2, Share2 } from "lucide-react"

type Status = "idle" | "copied_code" | "copied_link" | "shared"

export default function CopyJoinCode({ joinCode }: { joinCode: string }) {
  const [status, setStatus] = useState<Status>("idle")

  function getInviteUrl() {
    return `${window.location.origin}/brackets/join?code=${joinCode}`
  }

  function flash(s: Status) {
    setStatus(s)
    setTimeout(() => setStatus("idle"), 2000)
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement("textarea")
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    }
  }

  async function copyCode() {
    await copyText(joinCode)
    flash("copied_code")
  }

  async function shareOrCopyLink() {
    const url = getInviteUrl()
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my AllFantasy Bracket League",
          text: `Join my league with code ${joinCode}`,
          url,
        })
        flash("shared")
        return
      }
    } catch {}
    await copyText(url)
    flash("copied_link")
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-lg tracking-[0.3em] text-center select-all">
          {joinCode}
        </div>
        <button
          onClick={copyCode}
          className="rounded-xl border border-white/10 bg-white/10 p-3 hover:bg-white/15 transition"
          title="Copy code"
        >
          {status === "copied_code" ? (
            <Check className="h-5 w-5 text-emerald-400" />
          ) : (
            <Copy className="h-5 w-5 text-white/70" />
          )}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/40 font-mono truncate select-all">
        {typeof window !== "undefined"
          ? `${window.location.origin}/brackets/join?code=${joinCode}`
          : `…/brackets/join?code=${joinCode}`}
      </div>

      <button
        onClick={shareOrCopyLink}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black px-3 py-2.5 text-sm font-semibold hover:bg-gray-200 transition-colors"
      >
        {status === "copied_link" ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            <span>Link copied!</span>
          </>
        ) : status === "shared" ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            <span>Shared!</span>
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            <span>Share league</span>
          </>
        )}
      </button>
    </div>
  )
}
