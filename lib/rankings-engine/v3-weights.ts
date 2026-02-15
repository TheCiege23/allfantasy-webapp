import { prisma } from "@/lib/prisma"

export type RankingsWeights = {
  win: number
  power: number
  luck: number
  market: number
  skill: number
  marketAdj?: number
}

export function defaultWeights(): RankingsWeights {
  return {
    win: 0.22,
    power: 0.33,
    luck: 0.10,
    market: 0.20,
    skill: 0.15
  }
}

export function normalizeWeights(w: RankingsWeights): RankingsWeights {
  const entries = Object.entries(w).filter(([, v]) => typeof v === "number") as Array<[keyof RankingsWeights, number]>
  const sum = entries.reduce((a, [, v]) => a + v, 0)
  if (!sum || !Number.isFinite(sum)) return defaultWeights()
  const out: any = {}
  for (const [k, v] of entries) out[k] = v / sum
  return out as RankingsWeights
}

export function clampDelta(prev: RankingsWeights, next: RankingsWeights, maxDelta = 0.03) {
  const out: any = { ...prev }
  for (const key of Object.keys(prev) as Array<keyof RankingsWeights>) {
    const p = prev[key] ?? 0
    const n = next[key] ?? p
    const delta = Math.max(-maxDelta, Math.min(maxDelta, n - p))
    out[key] = p + delta
  }
  return normalizeWeights(out as RankingsWeights)
}

export async function saveWeightsSnapshot(args: {
  leagueId: string
  season: string
  week: number
  weights: RankingsWeights
  metrics?: any
  reason?: string
}) {
  const weights = normalizeWeights(args.weights)

  return prisma.rankingsWeightsSnapshot.create({
    data: {
      leagueId: args.leagueId,
      season: args.season,
      week: args.week,
      weights,
      metrics: args.metrics ?? null,
      reason: args.reason ?? null
    }
  })
}

export async function listWeightsSnapshots(args: { leagueId: string; season?: string; limit?: number }) {
  return prisma.rankingsWeightsSnapshot.findMany({
    where: { leagueId: args.leagueId, ...(args.season ? { season: args.season } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: args.limit ?? 20
  })
}
