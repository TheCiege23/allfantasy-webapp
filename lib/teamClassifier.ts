import { prisma } from '@/lib/prisma'

export type TeamArchetype = 'Contender' | 'Mid' | 'Rebuilder'

export interface TeamClassification {
  archetype: TeamArchetype
  confidence: number
  factors: {
    projectedWinRate: number
    avgAge: number
    positionalStrength: PositionalStrength
    recentPerformance: number
  }
}

export interface PositionalStrength {
  QB: number
  RB: number
  WR: number
  TE: number
  overall: number
}

const POSITION_WEIGHTS: Record<string, number> = {
  QB: 0.3,
  RB: 0.25,
  WR: 0.3,
  TE: 0.15,
}

const TIER_THRESHOLDS = {
  eliteAge: 24,
  youngAge: 26.5,
  oldAge: 28,
  strongWinRate: 0.65,
  avgWinRate: 0.45,
  strongPositional: 75,
}

export async function classifyTeam(
  leagueId: string,
  rosterPlayerIds: string[]
): Promise<TeamClassification> {
  const [league, historicalSeasons, players] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId } }),
    prisma.historicalSeason.findMany({
      where: { leagueId },
      orderBy: { season: 'desc' },
      take: 2,
    }),
    prisma.sportsPlayer.findMany({
      where: { sleeperId: { in: rosterPlayerIds }, sport: 'nfl' },
      select: { sleeperId: true, age: true, position: true, name: true },
    }),
  ])

  if (!league) throw new Error('League not found')

  const projectedWinRate = calculateProjectedWinRate(players)
  const avgAge = calculateAvgRosterAge(players)
  const positionalStrength = assessPositionalStrength(players)
  const recentPerformance = calculateRecentPerformance(
    historicalSeasons,
    league.leagueSize ?? 12
  )

  const archetype = determineArchetype(
    projectedWinRate,
    avgAge,
    positionalStrength.overall,
    recentPerformance,
    league.leagueSize ?? 12
  )

  const confidence = calculateConfidence(
    projectedWinRate,
    avgAge,
    positionalStrength.overall,
    players.length,
    rosterPlayerIds.length
  )

  return {
    archetype,
    confidence,
    factors: {
      projectedWinRate,
      avgAge,
      positionalStrength,
      recentPerformance,
    },
  }
}

function determineArchetype(
  winRate: number,
  avgAge: number,
  positionalScore: number,
  recentPerf: number,
  leagueSize: number
): TeamArchetype {
  const playoffCutoff = Math.ceil(leagueSize / 2)

  const contenderSignals =
    (winRate > TIER_THRESHOLDS.strongWinRate ? 1 : 0) +
    (avgAge < TIER_THRESHOLDS.youngAge ? 1 : 0) +
    (positionalScore > TIER_THRESHOLDS.strongPositional ? 1 : 0) +
    (recentPerf > playoffCutoff * 0.7 ? 1 : 0)

  const rebuilderSignals =
    (winRate < TIER_THRESHOLDS.avgWinRate ? 1 : 0) +
    (avgAge > TIER_THRESHOLDS.oldAge ? 1 : 0) +
    (positionalScore < 50 ? 1 : 0) +
    (recentPerf < playoffCutoff * 0.4 ? 1 : 0)

  if (contenderSignals >= 3) return 'Contender'
  if (rebuilderSignals >= 3) return 'Rebuilder'
  return 'Mid'
}

function calculateProjectedWinRate(
  players: { age: number | null; position: string | null }[]
): number {
  if (players.length === 0) return 0.5

  let score = 0
  let count = 0

  for (const p of players) {
    if (!p.position || !p.age) continue
    const posWeight = POSITION_WEIGHTS[p.position] ?? 0.1
    const ageFactor = p.age <= 25 ? 1.1 : p.age <= 28 ? 1.0 : p.age <= 30 ? 0.85 : 0.7
    score += posWeight * ageFactor
    count++
  }

  if (count === 0) return 0.5
  const normalized = score / count
  return Math.min(Math.max(normalized * 0.65, 0.2), 0.9)
}

function calculateAvgRosterAge(
  players: { age: number | null; position: string | null }[]
): number {
  const withAge = players.filter(
    (p) => p.age != null && ['QB', 'RB', 'WR', 'TE'].includes(p.position ?? '')
  )
  if (withAge.length === 0) return 27

  const total = withAge.reduce((sum, p) => sum + (p.age ?? 27), 0)
  return Math.round((total / withAge.length) * 10) / 10
}

function assessPositionalStrength(
  players: { position: string | null; age: number | null }[]
): PositionalStrength {
  const positionCounts: Record<string, { count: number; youngCount: number }> = {
    QB: { count: 0, youngCount: 0 },
    RB: { count: 0, youngCount: 0 },
    WR: { count: 0, youngCount: 0 },
    TE: { count: 0, youngCount: 0 },
  }

  const idealDepth: Record<string, number> = { QB: 2, RB: 5, WR: 5, TE: 2 }

  for (const p of players) {
    const pos = p.position ?? ''
    if (positionCounts[pos]) {
      positionCounts[pos].count++
      if ((p.age ?? 30) <= 26) positionCounts[pos].youngCount++
    }
  }

  const scores: Record<string, number> = {}
  let weightedTotal = 0
  let totalWeight = 0

  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    const { count, youngCount } = positionCounts[pos]
    const ideal = idealDepth[pos]
    const depthScore = Math.min(count / ideal, 1.0) * 60
    const youthBonus = count > 0 ? (youngCount / count) * 40 : 0
    const posScore = Math.round(depthScore + youthBonus)
    scores[pos] = Math.min(posScore, 100)

    const weight = POSITION_WEIGHTS[pos] ?? 0.1
    weightedTotal += scores[pos] * weight
    totalWeight += weight
  }

  return {
    QB: scores.QB,
    RB: scores.RB,
    WR: scores.WR,
    TE: scores.TE,
    overall: Math.round(totalWeight > 0 ? weightedTotal / totalWeight : 50),
  }
}

function calculateRecentPerformance(
  historicalSeasons: { standings: any }[],
  leagueSize: number
): number {
  if (!historicalSeasons || historicalSeasons.length === 0) return leagueSize / 2

  let totalWins = 0
  let seasonsCounted = 0

  for (const season of historicalSeasons) {
    const standings = season.standings as any
    if (standings?.yourWins != null) {
      totalWins += standings.yourWins
      seasonsCounted++
    } else if (standings?.wins != null) {
      totalWins += standings.wins
      seasonsCounted++
    }
  }

  if (seasonsCounted === 0) return leagueSize / 2
  return totalWins / seasonsCounted
}

function calculateConfidence(
  winRate: number,
  avgAge: number,
  positionalScore: number,
  matchedPlayers: number,
  totalPlayers: number
): number {
  const dataQuality = totalPlayers > 0 ? matchedPlayers / totalPlayers : 0
  const signalClarity =
    Math.abs(winRate - 0.5) * 2 +
    (avgAge < 25 || avgAge > 29 ? 0.3 : 0.1) +
    (positionalScore > 75 || positionalScore < 40 ? 0.3 : 0.1)

  const raw = dataQuality * 0.5 + Math.min(signalClarity, 1) * 0.5
  return Math.round(Math.min(Math.max(raw, 0.3), 0.95) * 100) / 100
}
