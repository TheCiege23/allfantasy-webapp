import { prisma } from "@/lib/prisma"

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
          luckDelta: t.luckDelta ?? null
        },
        create: {
          leagueId,
          season,
          week,
          rosterId: String(t.rosterId),
          rank: Number(t.rank),
          composite: t.composite,
          expectedWins: t.expectedWins ?? null,
          luckDelta: t.luckDelta ?? null
        }
      })
    )
  )
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
