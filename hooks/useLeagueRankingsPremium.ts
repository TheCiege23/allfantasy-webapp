"use client"

import { useEffect, useMemo, useState } from "react"
import { apiGet, apiPost } from "@/lib/api"

type HeatmapResponse = {
  leagueId: string
  leagueName: string
  season: string
  week: number
  phase: string
  computedAt: number
  cells: any[]
}

type PartnerProfilesResponse = {
  leagueId: string
  leagueName: string
  season: string
  week: number
  profiles: any[]
}

type RankHistoryResponse = {
  leagueId: string
  rosterId: string
  rows: Array<{ week: number; rank: number; season: string }>
}

export function useLeagueRankingsPremium(args: {
  leagueId: string
  week: number
  selectedRosterId?: string | number | null
  enableSnapshots?: boolean
}) {
  const { leagueId, week, selectedRosterId, enableSnapshots } = args

  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null)
  const [profiles, setProfiles] = useState<PartnerProfilesResponse | null>(null)
  const [rankHistory, setRankHistory] = useState<RankHistoryResponse | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const heatmapUrl = useMemo(
    () => `/api/leagues/${encodeURIComponent(leagueId)}/ldi-heatmap?week=${week}`,
    [leagueId, week]
  )

  const profilesUrl = useMemo(
    () => `/api/leagues/${encodeURIComponent(leagueId)}/partner-profiles?week=${week}`,
    [leagueId, week]
  )

  const historyUrl = useMemo(() => {
    if (!selectedRosterId) return null
    return `/api/leagues/${encodeURIComponent(leagueId)}/rank-history?rosterId=${encodeURIComponent(
      String(selectedRosterId)
    )}&limit=12`
  }, [leagueId, selectedRosterId])

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        setError(null)

        const [hm, pp] = await Promise.all([
          apiGet<HeatmapResponse>(heatmapUrl),
          apiGet<PartnerProfilesResponse>(profilesUrl)
        ])

        if (cancelled) return
        setHeatmap(hm)
        setProfiles(pp)

        if (historyUrl) {
          const rh = await apiGet<RankHistoryResponse>(historyUrl)
          if (cancelled) return
          setRankHistory(rh)
        } else {
          setRankHistory(null)
        }

        if (enableSnapshots) {
          await apiPost<{ ok: boolean }>(`/api/leagues/${encodeURIComponent(leagueId)}/snapshots`, { week })
        }
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message ?? "Unknown error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (leagueId && week) run()
    return () => {
      cancelled = true
    }
  }, [leagueId, week, heatmapUrl, profilesUrl, historyUrl, enableSnapshots])

  return {
    heatmap,
    profiles,
    rankHistory,
    loading,
    error
  }
}
