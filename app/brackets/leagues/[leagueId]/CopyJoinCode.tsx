"use client"

import { useState } from "react"
import { Copy, Check, Link2 } from "lucide-react"

export default function CopyJoinCode({ joinCode }: { joinCode: string }) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

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
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyInviteLink() {
    const url = `${window.location.origin}/brackets/join?code=${joinCode}`
    await copyText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
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
          {copied ? (
            <Check className="h-5 w-5 text-emerald-400" />
          ) : (
            <Copy className="h-5 w-5 text-white/70" />
          )}
        </button>
      </div>
      <button
        onClick={copyInviteLink}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition"
      >
        {linkCopied ? (
          <>
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-emerald-400">Link copied!</span>
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            <span>Copy invite link</span>
          </>
        )}
      </button>
    </div>
  )
}
