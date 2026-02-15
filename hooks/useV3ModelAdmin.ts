"use client"

import { useEffect, useMemo, useState } from "react"
import { apiGet, apiPost } from "@/lib/api"

type WeightsGetResponse = { leagueId: string; rows: any[]; default: any }
type DriftGetResponse = { leagueId: string; rows: any[] }

export function useV3ModelAdmin(args: { leagueId: string; season?: string | null }) {
  const { leagueId, season } = args

  const [weights, setWeights] = useState<WeightsGetResponse | null>(null)
  const [drift, setDrift] = useState<DriftGetResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weightsUrl = useMemo(() => {
    if (!leagueId) return null
    const s = season ? `?season=${encodeURIComponent(season)}` : ""
    return `/api/leagues/${encodeURIComponent(leagueId)}/v3/weights${s}`
  }, [leagueId, season])

  const driftUrl = useMemo(() => {
    if (!leagueId) return null
    return `/api/leagues/${encodeURIComponent(leagueId)}/v3/drift?days=60`
  }, [leagueId])

  async function refresh() {
    if (!weightsUrl || !driftUrl) return
    setLoading(true)
    setError(null)
    try {
      const [w, d] = await Promise.all([
        apiGet<WeightsGetResponse>(weightsUrl),
        apiGet<DriftGetResponse>(driftUrl)
      ])
      setWeights(w)
      setDrift(d)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load V3 admin data")
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
  }, [weightsUrl, driftUrl])

  async function createSnapshot(payload: { season: string; week: number; weights: any; reason?: string }) {
    setLoading(true)
    setError(null)
    try {
      await apiPost(`/api/leagues/${encodeURIComponent(leagueId)}/v3/weights`, payload)
      await refresh()
    } catch (e: any) {
      setError(e?.message ?? "Failed to create weights snapshot")
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { weights, drift, loading, error, refresh, createSnapshot }
}
