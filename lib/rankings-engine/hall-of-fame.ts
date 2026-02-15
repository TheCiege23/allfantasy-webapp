import { prisma } from "@/lib/prisma"

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

export async function upsertSeasonResults(args: {
  leagueId: string
  season: string
  rows: Array<{
    rosterId: string
    wins?: number | null
    losses?: number | null
    pointsFor?: number | null
    pointsAgainst?: number | null
    champion?: boolean
  }>
}) {
  await prisma.$transaction(
    args.rows.map((r) =>
      prisma.seasonResult.upsert({
        where: {
          uniq_season_result_league_season_roster: {
            leagueId: args.leagueId,
            season: args.season,
            rosterId: r.rosterId
          }
        },
        update: {
          wins: r.wins ?? null,
          losses: r.losses ?? null,
          pointsFor: r.pointsFor ?? null,
          pointsAgainst: r.pointsAgainst ?? null,
          champion: !!r.champion
        },
        create: {
          leagueId: args.leagueId,
          season: args.season,
          rosterId: r.rosterId,
          wins: r.wins ?? null,
          losses: r.losses ?? null,
          pointsFor: r.pointsFor ?? null,
          pointsAgainst: r.pointsAgainst ?? null,
          champion: !!r.champion
        }
      })
    )
  )
}

export async function rebuildHallOfFame(args: { leagueId: string }) {
  const seasons = await prisma.seasonResult.findMany({
    where: { leagueId: args.leagueId }
  })

  const bySeason: Record<string, typeof seasons> = {}
  for (const row of seasons) {
    bySeason[row.season] = bySeason[row.season] ?? []
    bySeason[row.season].push(row)
  }

  const dominanceByRoster: Record<string, number[]> = {}
  const champCount: Record<string, number> = {}
  const seasonsPlayed: Record<string, number> = {}

  for (const season of Object.keys(bySeason)) {
    const rows = bySeason[season]

    const sorted = [...rows].sort((a, b) => {
      const aw = a.wins ?? -999
      const bw = b.wins ?? -999
      if (bw !== aw) return bw - aw
      const ap = Number(a.pointsFor ?? 0)
      const bp = Number(b.pointsFor ?? 0)
      return bp - ap
    })

    const n = sorted.length || 1
    sorted.forEach((r, idx) => {
      const rosterId = r.rosterId
      const finishScore = 1 - idx / Math.max(1, n - 1)
      dominanceByRoster[rosterId] = dominanceByRoster[rosterId] ?? []
      dominanceByRoster[rosterId].push(finishScore)

      champCount[rosterId] = (champCount[rosterId] ?? 0) + (r.champion ? 1 : 0)
      seasonsPlayed[rosterId] = (seasonsPlayed[rosterId] ?? 0) + 1
    })
  }

  const rosterIds = Object.keys(seasonsPlayed)
  const hofRows = rosterIds.map((rosterId) => {
    const champs = champCount[rosterId] ?? 0
    const played = seasonsPlayed[rosterId] ?? 0

    const domArr = dominanceByRoster[rosterId] ?? []
    const dominance = domArr.length ? domArr.reduce((a, b) => a + b, 0) / domArr.length : 0

    const efficiency = 0

    const longevity = clamp01(played / Math.max(1, Object.keys(bySeason).length))

    const score =
      0.55 * clamp01(champs / Math.max(1, Math.max(...Object.values(champCount)))) +
      0.30 * dominance +
      0.10 * longevity +
      0.05 * efficiency

    return {
      rosterId,
      championships: champs,
      seasonsPlayed: played,
      dominance,
      efficiency,
      longevity,
      score
    }
  })

  await prisma.$transaction(
    hofRows.map((r) =>
      prisma.hallOfFameRow.upsert({
        where: { uniq_hof_league_roster: { leagueId: args.leagueId, rosterId: r.rosterId } },
        update: {
          championships: r.championships,
          seasonsPlayed: r.seasonsPlayed,
          dominance: r.dominance,
          efficiency: r.efficiency,
          longevity: r.longevity,
          score: r.score
        },
        create: {
          leagueId: args.leagueId,
          rosterId: r.rosterId,
          championships: r.championships,
          seasonsPlayed: r.seasonsPlayed,
          dominance: r.dominance,
          efficiency: r.efficiency,
          longevity: r.longevity,
          score: r.score
        }
      })
    )
  )

  return { ok: true, count: hofRows.length }
}

export async function getHallOfFame(args: { leagueId: string }) {
  return prisma.hallOfFameRow.findMany({
    where: { leagueId: args.leagueId },
    orderBy: [{ score: "desc" }, { championships: "desc" }]
  })
}

export async function getSeasonLeaderboard(args: { leagueId: string; season: string }) {
  return prisma.seasonResult.findMany({
    where: { leagueId: args.leagueId, season: args.season },
    orderBy: [{ wins: "desc" }, { pointsFor: "desc" }]
  })
}
