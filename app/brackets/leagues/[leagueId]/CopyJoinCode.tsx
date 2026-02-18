"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export default function CopyJoinCode({ joinCode }: { joinCode: string }) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement("textarea")
      el.value = joinCode
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-lg tracking-[0.3em] text-center select-all">
        {joinCode}
      </div>
      <button
        onClick={copyCode}
        className="rounded-xl border border-white/10 bg-white/10 p-3 hover:bg-white/15 transition"
        title="Copy code"
      >
        {copied ? (
          <Check className="h-5 w-5 text-emerald-400" />
        ) : (
          <Copy className="h-5 w-5 text-white/70" />
        )}
      </button>
    </div>
  )
}
