"use client"

import { useState, useEffect } from "react"

const MODES = ["light", "dark", "legacy"] as const
type Mode = (typeof MODES)[number]

const LABELS: Record<Mode, string> = {
  light: "Light",
  dark: "Dark",
  legacy: "AF Legacy",
}

function getStoredMode(): Mode {
  if (typeof window === "undefined") return "light"
  const stored = localStorage.getItem("af_mode")
  if (stored === "dark" || stored === "light" || stored === "legacy") return stored
  return "light"
}

export function GlobalModeToggle() {
  const [mode, setMode] = useState<Mode>("light")

  useEffect(() => {
    setMode(getStoredMode())
  }, [])

  function cycleMode() {
    const idx = MODES.indexOf(mode)
    const next = MODES[(idx + 1) % MODES.length]
    setMode(next)
    localStorage.setItem("af_mode", next)
    document.documentElement.setAttribute("data-mode", next)
  }

  return (
    <button
      onClick={cycleMode}
      aria-label={`Theme: ${LABELS[mode]}`}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-white/10 bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] shadow-lg hover:bg-[var(--panel2)] transition-colors"
    >
      {LABELS[mode]}
    </button>
  )
}
