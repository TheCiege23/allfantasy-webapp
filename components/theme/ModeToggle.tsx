"use client"

import React, { useState, useEffect } from "react"
import { useThemeMode } from "./ThemeProvider"

export function ModeToggle(props: { className?: string }) {
  const { mode, cycleMode } = useThemeMode()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const label = mode === "dark" ? "Dark" : mode === "light" ? "Light" : "AF Legacy"
  const icon = mode === "dark" ? "🌙" : mode === "light" ? "☀️" : "⚡"

  return (
    <button
      onClick={cycleMode}
      className={
        props.className ??
        "rounded-xl border px-3 py-2 text-sm font-semibold active:scale-[0.98] transition"
      }
      style={{
        color: 'var(--text)',
        borderColor: 'var(--border)',
        background: 'var(--panel)',
      }}
      title="Toggle theme mode"
      suppressHydrationWarning
    >
      {mounted ? `${icon} ${label}` : '\u00A0'}
    </button>
  )
}
