"use client"

import { useEffect, useRef, useState } from "react"

type LivePayload = {
  ok: boolean
  tournamentId: string
  games: Array<{
    id: string
    homeTeam: string
    awayTeam: string
    homeScore: number | null
    awayScore: number | null
    status: string | null
    startTime: string | null
  }>
  standings: null | Array<{
    entryId: string
    entryName: string
    ownerName: string
    points: number
  }>
}

export function useBracketLive(opts: {
  tournamentId: string
  leagueId?: string
  enabled?: boolean
  intervalMs?: number
}) {
  const { tournamentId, leagueId, enabled = true, intervalMs = 15000 } = opts

  const [data, setData] = useState<LivePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function tick() {
    try {
      const qs = new URLSearchParams({ tournamentId })
      if (leagueId) qs.set("leagueId", leagueId)
      const res = await fetch(`/api/bracket/live?${qs.toString()}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Live fetch failed")
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? "Live fetch failed")
    }
  }

  useEffect(() => {
    if (!enabled) return
    tick()
    timer.current = setInterval(tick, intervalMs)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, leagueId, enabled, intervalMs])

  return { data, error, refresh: tick }
}
