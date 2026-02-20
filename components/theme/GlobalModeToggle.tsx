"use client"

import { ModeToggle } from "@/components/theme/ModeToggle"

export function GlobalModeToggle() {
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <ModeToggle className="rounded-xl border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur"
      />
    </div>
  )
}
