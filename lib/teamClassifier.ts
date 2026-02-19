import { prisma } from '@/lib/prisma'

export type TeamArchetype = 'Contender' | 'Mid' | 'Rebuilder'

export interface ArchetypeResult {
  archetype: TeamArchetype
  score: number
  explanation: string
  factors: {
    projectedWins: number
    avgStarterAge: number
    depthByPosition: Record<string, number>
    overallDepth: number
    recentWinsAvg: number
    futureCapitalScore: number
  }
}

export interface RosterPlayer {
  playerId: string
  position: string
  projectedPoints?: number
  age?: number
  isStarter?: boolean
}

export async function classifyTeam(
  leagueId: string,
  userRoster: RosterPlayer[],
  userFuturePicks: number = 0
): Promise<ArchetypeResult> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  })

  if (!league) throw new Error('League not found')

  const historicalSeasons = await prisma.historicalSeason.findMany({
    where: { leagueId },
    orderBy: { season: 'desc' },
    take: 2,
  })

  const playerIds = userRoster.map(p => p.playerId).filter(Boolean)
  const dbPlayers = playerIds.length > 0
    ? await prisma.sportsPlayer.findMany({
        where: { sleeperId: { in: playerIds }, sport: 'nfl' },
        select: { sleeperId: true, age: true, position: true },
      })
    : []

  const playerAgeMap = new Map(
    dbPlayers.filter(p => p.sleeperId).map(p => [p.sleeperId!, p.age])
  )

  const enrichedRoster = userRoster.map(p => ({
    ...p,
    age: p.age ?? playerAgeMap.get(p.playerId) ?? undefined,
  }))

  const projectedWins = calculateProjectedWins(enrichedRoster)
  const avgStarterAge = calculateAvgStarterAge(enrichedRoster)
  const { depthByPosition, overallDepth } = calculateDepth(enrichedRoster)
  const recentWinsAvg = calculateRecentWins(historicalSeasons)
  const futureCapitalScore = Math.max(100 - userFuturePicks * 12, 20)

  const score = calculateFinalScore(
    projectedWins,
    avgStarterAge,
    overallDepth,
    recentWinsAvg,
    futureCapitalScore
  )

  const { archetype, explanation } = classifyFromScore(score, avgStarterAge)

  return {
    archetype,
    score,
    explanation,
    factors: {
      projectedWins,
      avgStarterAge,
      depthByPosition,
      overallDepth,
      recentWinsAvg,
      futureCapitalScore,
    },
  }
}

function calculateProjectedWins(roster: RosterPlayer[]): number {
  const totalProjectedPoints = roster.reduce(
    (sum, p) => sum + (p.projectedPoints || 0),
    0
  )
  const avgProjectedPoints =
    roster.length > 0 ? totalProjectedPoints / roster.length : 0

  return Math.min(Math.max((avgProjectedPoints - 120) / 80, 0), 1)
}

function calculateAvgStarterAge(roster: RosterPlayer[]): number {
  const starters = roster.filter(p => p.isStarter)
  const pool = starters.length > 0 ? starters : roster

  const withAge = pool.filter(
    p => p.age != null && ['QB', 'RB', 'WR', 'TE'].includes(p.position)
  )

  if (withAge.length === 0) return 27

  const total = withAge.reduce((sum, p) => sum + (p.age ?? 27), 0)
  return Math.round((total / withAge.length) * 10) / 10
}

function calculateDepth(roster: RosterPlayer[]): {
  depthByPosition: Record<string, number>
  overallDepth: number
} {
  const depthByPosition: Record<string, number> = {}

  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    const count = roster.filter(p => p.position === pos).length
    depthByPosition[pos] = Math.min(count * 12, 100)
  }

  const values = Object.values(depthByPosition)
  const overallDepth =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 50

  return { depthByPosition, overallDepth }
}

function calculateRecentWins(
  historicalSeasons: { standings: any }[]
): number {
  if (!historicalSeasons || historicalSeasons.length === 0) return 0

  let totalWins = 0
  let seasonsCounted = 0

  for (const season of historicalSeasons) {
    const standings = season.standings as any
    const wins = standings?.yourWins ?? standings?.wins ?? null
    if (wins != null) {
      totalWins += wins
      seasonsCounted++
    }
  }

  if (seasonsCounted === 0) return 0
  return totalWins / seasonsCounted
}

function calculateFinalScore(
  projectedWins: number,
  avgStarterAge: number,
  overallDepth: number,
  recentWinsAvg: number,
  futureCapitalScore: number
): number {
  const youthBonus = Math.max(30 - (avgStarterAge - 24) * 2, 0) * 0.8

  const score =
    projectedWins * 35 +
    youthBonus +
    overallDepth * 0.25 +
    (recentWinsAvg / 14) * 15 +
    futureCapitalScore * 0.15

  return Math.round(Math.max(Math.min(score, 100), 0))
}

function classifyFromScore(
  score: number,
  avgAge: number
): { archetype: TeamArchetype; explanation: string } {
  if (score >= 78) {
    return {
      archetype: 'Contender',
      explanation:
        `Strong projected wins, young core (avg ${avgAge}), and excellent depth. ` +
        `You're built to compete now and for the next 2-3 seasons.`,
    }
  }

  if (score >= 55) {
    return {
      archetype: 'Mid',
      explanation:
        `Playoff bubble team (avg age ${avgAge}). Solid foundation but one or two ` +
        `moves away from serious contention. Consider targeted upgrades at your weakest position.`,
    }
  }

  return {
    archetype: 'Rebuilder',
    explanation:
      `Low projected wins and/or heavy future capital (avg age ${avgAge}). ` +
      `Perfect time to accumulate young assets and draft picks — reset for 2027+.`,
  }
}
