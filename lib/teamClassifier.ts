import { prisma } from '@/lib/prisma'

export type TeamArchetype = 'Contender' | 'Mid' | 'Rebuilder'

export interface ArchetypeResult {
  archetype: TeamArchetype
  score: number
  explanation: string
  positionalNeeds: string
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
  futurePicksCount: number = 0
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
  const recentWins = calculateRecentWins(historicalSeasons)
  const { needs, positionalNeeds } = calculatePositionalNeeds(enrichedRoster)
  const criticalCount = Object.values(needs).filter(n => n === 'critical').length

  const score = calculateFinalScore(
    projectedWins,
    avgStarterAge,
    recentWins,
    futurePicksCount,
    criticalCount
  )

  const { archetype, explanation } = classifyFromScore(score)

  return {
    archetype,
    score,
    explanation,
    positionalNeeds,
  }
}

function calculateProjectedWins(roster: RosterPlayer[]): number {
  const totalProjectedPoints = roster.reduce(
    (sum, p) => sum + (p.projectedPoints || 0),
    0
  )
  const avg = roster.length > 0 ? totalProjectedPoints / roster.length : 0
  return Math.min(Math.max((avg - 118) / 85, 0), 1)
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

function calculateRecentWins(
  historicalSeasons: { standings: any }[]
): number {
  if (!historicalSeasons || historicalSeasons.length === 0) return 7

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

  if (seasonsCounted === 0) return 7
  return totalWins / seasonsCounted
}

function calculatePositionalNeeds(roster: RosterPlayer[]): {
  needs: Record<string, string>
  positionalNeeds: string
} {
  const posCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 }

  for (const p of roster) {
    if (posCounts[p.position] !== undefined) {
      posCounts[p.position]++
    }
  }

  const needs: Record<string, string> = {}

  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    const count = posCounts[pos]
    if (count <= 1) needs[pos] = 'critical'
    else if (count <= 2) needs[pos] = 'weak'
    else if (count >= 4) needs[pos] = 'strong'
    else needs[pos] = 'solid'
  }

  const positionalNeeds =
    `RB ${needs.RB} (${posCounts.RB} rostered), ` +
    `WR ${needs.WR} (${posCounts.WR}), ` +
    `QB ${needs.QB} (${posCounts.QB}), ` +
    `TE ${needs.TE} (${posCounts.TE})`

  return { needs, positionalNeeds }
}

function calculateFinalScore(
  projectedWins: number,
  avgStarterAge: number,
  recentWins: number,
  futurePicksCount: number,
  criticalNeedsCount: number
): number {
  const youthBonus = (30 - (avgStarterAge - 24) * 2.2) * 0.85
  const capitalScore = futurePicksCount > 4 ? 15 : 40 - futurePicksCount * 6
  const criticalPenalty = criticalNeedsCount * -12

  const score =
    projectedWins * 35 +
    youthBonus +
    (recentWins / 14) * 18 +
    capitalScore +
    criticalPenalty

  return Math.round(Math.max(Math.min(score, 100), 10))
}

function classifyFromScore(
  score: number
): { archetype: TeamArchetype; explanation: string } {
  if (score >= 78) {
    return {
      archetype: 'Contender',
      explanation:
        'Young core, strong projections, and excellent depth. Built to win now and sustain through 2028.',
    }
  }

  if (score >= 54) {
    return {
      archetype: 'Mid',
      explanation:
        'Playoff contender with room to improve. One or two key pieces could push you over the top.',
    }
  }

  return {
    archetype: 'Rebuilder',
    explanation:
      'Accumulating future capital and resetting the roster for a strong 2027+ window.',
  }
}
