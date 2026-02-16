"use client"

import { useEffect, useMemo, useState } from "react"
import { apiGet, apiPost } from "@/lib/api"

type DraftGradesGetResponse = { leagueId: string; season: string; rows: any[]; meta?: { fallbackMode?: boolean; rankingSourceNote?: string } }
type DraftGradesPostResponse =
  | { ok: true; leagueId: string; season: string; count: number }
  | { leagueId: string; leagueName: string; season: string; week: number; phase: string; grades: any[]; note?: string }

export function useDraftGrades(args: { leagueId: string; season?: string | null }) {
  const { leagueId, season } = args

  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ fallbackMode?: boolean; rankingSourceNote?: string } | null>(null)

  const url = useMemo(() => {
    if (!leagueId || !season) return null
    return `/api/leagues/${encodeURIComponent(leagueId)}/draft-grades?season=${encodeURIComponent(season)}`
  }, [leagueId, season])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!url) return
      try {
        setLoading(true)
        setError(null)
        const data = await apiGet<DraftGradesGetResponse>(url)
        if (!cancelled) {
          setRows(data.rows ?? [])
          setMeta(data.meta ?? null)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load draft grades")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [url])

  async function computeAndPersist(week: number) {
    if (!leagueId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost<DraftGradesPostResponse>(
        `/api/leagues/${encodeURIComponent(leagueId)}/draft-grades`,
        { week }
      )

      if ("note" in data && data.note) {
        setError(data.note)
      }
      import("@/lib/telemetry/client").then(m => m.logLegacyToolUsage({ tool: "DraftGrades", leagueId, action: "compute", meta: { week } })).catch(() => {})
      return data
    } catch (e: any) {
      setError(e?.message ?? "Failed to compute draft grades")
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { rows, loading, error, meta, computeAndPersist }
}
