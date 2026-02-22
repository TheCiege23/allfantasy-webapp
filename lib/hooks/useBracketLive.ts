"use client"

import { useEffect, useRef, useState, useCallback } from "react"

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
    ownerName?: string
    userId?: string
    displayName?: string | null
    avatarUrl?: string | null
    points?: number
    totalPoints?: number
    correctPicks?: number
    totalPicks?: number
    roundCorrect?: Record<number, number>
    championPick?: string | null
    maxPossible?: number
  }>
  sleeperTeams?: string[]
  hasLiveGames?: boolean
  pollIntervalMs?: number
}

export function useBracketLive(opts: {
  tournamentId: string
  leagueId?: string
  enabled?: boolean
  intervalMs?: number
  useSSE?: boolean
}) {
  const { tournamentId, leagueId, enabled = true, intervalMs = 15000, useSSE = false } = opts

  const [data, setData] = useState<LivePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const tick = useCallback(async () => {
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
  }, [tournamentId, leagueId])

  useEffect(() => {
    if (!enabled) return

    if (useSSE && typeof EventSource !== "undefined") {
      const qs = new URLSearchParams({ tournamentId })
      if (leagueId) qs.set("leagueId", leagueId)
      const es = new EventSource(`/api/bracket/live/stream?${qs.toString()}`)
      eventSourceRef.current = es

      es.addEventListener("connected", () => {
        setConnected(true)
        setError(null)
      })

      es.addEventListener("update", (e) => {
        try {
          const payload = JSON.parse(e.data)
          setData((prev) => ({
            ...prev,
            ok: true,
            tournamentId,
            games: payload.games ?? prev?.games ?? [],
            standings: payload.standings ?? prev?.standings ?? null,
            hasLiveGames: payload.hasLive,
          }))
          setError(null)
        } catch {}
      })

      es.addEventListener("error", () => {
        setConnected(false)
        setError("Connection lost, reconnecting...")
      })

      es.onerror = () => {
        setConnected(false)
      }

      return () => {
        es.close()
        eventSourceRef.current = null
        setConnected(false)
      }
    }

    tick()
    timer.current = setInterval(tick, intervalMs)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [tournamentId, leagueId, enabled, intervalMs, useSSE, tick])

  return { data, error, refresh: tick, connected }
}
