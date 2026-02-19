import { prisma } from "@/lib/prisma"

export interface SnapshotMetrics {
  starterValuePercentile: number
  expectedWins: number
  injuryHealthRatio: number
  tradeEffPremium: number
}

export async function saveRankingsSnapshot(args: {
  leagueId: string
  season: string
  week: number
  teams: Array<{
    rosterId: string | number
    rank: number
    composite: number
    expectedWins?: number | null
    luckDelta?: number | null
    metricsJson?: SnapshotMetrics | null
  }>
}) {
  const { leagueId, season, week } = args

  await prisma.$transaction(
    args.teams.map((t) =>
      prisma.rankingsSnapshot.upsert({
        where: {
          uniq_snapshot_league_season_week_roster: {
            leagueId,
            season,
            week,
            rosterId: String(t.rosterId)
          }
        },
        update: {
          rank: Number(t.rank),
          composite: t.composite,
          expectedWins: t.expectedWins ?? null,
          luckDelta: t.luckDelta ?? null,
          metricsJson: t.metricsJson ?? undefined,
        },
        create: {
          leagueId,
          season,
          week,
          rosterId: String(t.rosterId),
          rank: Number(t.rank),
          composite: t.composite,
          expectedWins: t.expectedWins ?? null,
          luckDelta: t.luckDelta ?? null,
          metricsJson: t.metricsJson ?? undefined,
        }
      })
    )
  )
}

export async function getPreviousWeekSnapshots(args: {
  leagueId: string
  season: string
  currentWeek: number
}): Promise<Map<string, { rank: number; composite: number; metrics: SnapshotMetrics | null }>> {
  const prevWeek = args.currentWeek - 1
  if (prevWeek < 1) return new Map()

  const rows = await prisma.rankingsSnapshot.findMany({
    where: {
      leagueId: args.leagueId,
      season: args.season,
      week: prevWeek,
    },
  })

  const map = new Map<string, { rank: number; composite: number; metrics: SnapshotMetrics | null }>()
  for (const r of rows) {
    const metrics = r.metricsJson as SnapshotMetrics | null
    map.set(r.rosterId, {
      rank: r.rank,
      composite: Number(r.composite),
      metrics,
    })
  }
  return map
}

export async function getRankHistory(args: {
  leagueId: string
  rosterId: string
  limit?: number
}) {
  const rows = await prisma.rankingsSnapshot.findMany({
    where: { leagueId: args.leagueId, rosterId: args.rosterId },
    orderBy: [{ season: "desc" }, { week: "desc" }],
    take: args.limit ?? 12
  })

  return rows.reverse()
}
