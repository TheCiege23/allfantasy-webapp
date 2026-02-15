import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type BucketType = "hour" | "day" | "week" | "month"

export const GET = withApiUsage({ endpoint: "/api/admin/usage/summary", tool: "AdminUsageSummary" })(async (req: Request) => {
  const url = new URL(req.url)

  const bucketType = String(url.searchParams.get("bucketType") ?? "day") as BucketType
  const days = Number(url.searchParams.get("days") ?? 30)
  const scope = url.searchParams.get("scope") ? String(url.searchParams.get("scope")) : undefined
  const endpoint = url.searchParams.get("endpoint") ? String(url.searchParams.get("endpoint")) : undefined
  const tool = url.searchParams.get("tool") ? String(url.searchParams.get("tool")) : undefined
  const leagueId = url.searchParams.get("leagueId") ? String(url.searchParams.get("leagueId")) : undefined
  const topN = Number(url.searchParams.get("topN") ?? 8)

  const since = new Date(Date.now() - days * 24 * 3600 * 1000)

  const where = {
    bucketType,
    bucketStart: { gte: since },
    ...(scope ? { scope } : {}),
    ...(endpoint ? { endpoint } : {}),
    ...(tool ? { tool } : {}),
    ...(leagueId ? { leagueId } : {})
  } as const

  const rows = await prisma.apiUsageRollup.findMany({
    where,
    select: {
      endpoint: true,
      tool: true,
      leagueId: true,
      count: true,
      okCount: true,
      errCount: true,
      avgMs: true,
      p95Ms: true,
      maxMs: true
    }
  })

  const totals = rows.reduce(
    (acc: { count: number; ok: number; err: number; avgMsSum: number; avgMsN: number }, r: any) => {
      acc.count += r.count ?? 0
      acc.ok += r.okCount ?? 0
      acc.err += r.errCount ?? 0
      acc.avgMsSum += Number(r.avgMs ?? 0)
      acc.avgMsN += r.avgMs == null ? 0 : 1
      return acc
    },
    { count: 0, ok: 0, err: 0, avgMsSum: 0, avgMsN: 0 }
  )

  const errRate = totals.count ? Math.round((totals.err / totals.count) * 1000) / 10 : 0
  const avgMs = totals.avgMsN ? Math.round(totals.avgMsSum / totals.avgMsN) : null

  function topBy<K extends "endpoint" | "tool" | "leagueId">(key: K) {
    const m = new Map<string, { count: number; err: number; p95: number | null }>()
    for (const r of rows) {
      const raw = r[key] as string | null | undefined
      const k = (!raw || raw === "") ? "(none)" : raw
      const cur = m.get(k) ?? { count: 0, err: 0, p95: null as number | null }
      cur.count += r.count ?? 0
      cur.err += r.errCount ?? 0
      cur.p95 = Math.max(cur.p95 ?? 0, Number(r.p95Ms ?? 0)) || cur.p95
      m.set(k, cur)
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
  }

  const topEndpoints = topBy("endpoint")
  const topTools = topBy("tool")
  const topLeagues = topBy("leagueId")

  const topErrorEndpoints = [...topEndpoints]
    .sort((a, b) => b.err - a.err)
    .slice(0, topN)

  const mostExpensiveEndpoints = [...topEndpoints]
    .sort((a, b) => Number(b.p95 ?? 0) - Number(a.p95 ?? 0))
    .slice(0, topN)

  return NextResponse.json({
    bucketType,
    days,
    since,
    totals: { ...totals, errRate, avgMs },
    topEndpoints,
    topTools,
    topLeagues,
    topErrorEndpoints,
    mostExpensiveEndpoints
  })
})
