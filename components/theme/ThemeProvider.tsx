"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

export type AppMode = "dark" | "light" | "legacy"

type ThemeCtx = {
  mode: AppMode
  setMode: (m: AppMode) => void
  cycleMode: () => void
}

const Ctx = createContext<ThemeCtx | null>(null)

const STORAGE_KEY = "af_mode"

export function ThemeProvider(props: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("dark")

  useEffect(() => {
    const saved = (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) as AppMode | null
    if (saved === "dark" || saved === "light" || saved === "legacy") setModeState(saved)
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.dataset.mode = mode
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {}
  }, [mode])

  const api = useMemo<ThemeCtx>(() => {
    return {
      mode,
      setMode: (m) => setModeState(m),
      cycleMode: () =>
        setModeState((prev) => (prev === "dark" ? "light" : prev === "light" ? "legacy" : "dark"))
    }
  }, [mode])

  return <Ctx.Provider value={api}>{props.children}</Ctx.Provider>
}

export function useThemeMode() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useThemeMode must be used inside ThemeProvider")
  return v
}
