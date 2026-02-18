"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

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
          "px-3 py-2 rounded-xl text-sm font-medium transition",
          active("/brackets") ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/10 hover:text-white",
        ].join(" ")}
      >
        Brackets
      </Link>

      {isMarch && (
        <Link
          href="/brackets"
          className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow hover:opacity-95 transition"
        >
          <span>🏀</span> Bracket Challenge <span className="text-[11px] bg-orange-500 px-2 py-0.5 rounded-full">LIVE</span>
        </Link>
      )}
    </div>
  )
}
