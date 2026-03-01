"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Heart } from "lucide-react"

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
          "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition shadow",
          active("/brackets")
            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
            : "bg-gradient-to-r from-purple-600/80 to-indigo-600/80 text-white hover:opacity-95",
        ].join(" ")}
      >
        <span>🏀</span> Bracket Challenge {isMarch && <span className="text-[11px] bg-orange-500 px-2 py-0.5 rounded-full">LIVE</span>}
      </Link>

      <Link
        href="/support"
        className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition hover:opacity-90"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}
      >
        <Heart className="w-3.5 h-3.5" />
        Support
      </Link>
    </div>
  )
}
