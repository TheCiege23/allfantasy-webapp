"use client"

import { useEffect, useMemo, useState } from "react"
import { apiGet, apiPost } from "@/lib/api"

type HallOfFameGetResponse = { leagueId: string; rows: any[] }
type SeasonLeaderboardGetResponse = { leagueId: string; season: string; rows: any[] }

export function useHallOfFame(args: { leagueId: string; season?: string | null }) {
  const { leagueId, season } = args

  const [hofRows, setHofRows] = useState<any[]>([])
  const [seasonRows, setSeasonRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hofUrl = useMemo(() => {
    if (!leagueId) return null
    return `/api/leagues/${encodeURIComponent(leagueId)}/hall-of-fame`
  }, [leagueId])

  const seasonUrl = useMemo(() => {
    if (!leagueId || !season) return null
    return `/api/leagues/${encodeURIComponent(leagueId)}/hall-of-fame?season=${encodeURIComponent(season)}`
  }, [leagueId, season])

  async function refresh() {
    if (!hofUrl) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<HallOfFameGetResponse>(hofUrl)
      setHofRows(data.rows ?? [])
      if (seasonUrl) {
        const s = await apiGet<SeasonLeaderboardGetResponse>(seasonUrl)
        setSeasonRows(s.rows ?? [])
      } else {
        setSeasonRows([])
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load Hall of Fame")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await refresh()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hofUrl, seasonUrl])

  async function rebuild() {
    if (!hofUrl) return
    setLoading(true)
    setError(null)
    try {
      await apiPost(`/api/leagues/${encodeURIComponent(leagueId)}/hall-of-fame`, {})
      await refresh()
      import("@/lib/telemetry/client").then(m => m.logLegacyToolUsage({ tool: "HallOfFame", leagueId, action: "rebuild" })).catch(() => {})
    } catch (e: any) {
      setError(e?.message ?? "Failed to rebuild Hall of Fame")
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { hofRows, seasonRows, loading, error, rebuild, refresh }
}
