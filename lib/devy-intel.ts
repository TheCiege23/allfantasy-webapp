import type { DevyPlayer } from '@prisma/client'
import { getPlayerAnalytics, type PlayerAnalytics } from './player-analytics'

export interface DevyIntelMetrics {
  recruitingComposite: number
  productionIndex: number
  breakoutAge: number | null
  breakoutAgeScore: number
  athleticProfileScore: number
  draftCapitalScore: number
  draftProjectionScore: number
  projectedDraftRound: number
  projectedDraftPick: number
  nilImpactScore: number
  injurySeverityScore: number
  volatilityScore: number
}

export interface DevyFinalScore {
  finalScore: number
  draftProjectionComponent: number
  adpMarketComponent: number
  leagueNeedComponent: number
  scarcityComponent: number
  volatilityComponent: number
}

const DRAFT_CAPITAL_MULTIPLIERS: Record<number, number> = {
  1: 1.00,
  2: 0.80,
  3: 0.65,
  4: 0.50,
  5: 0.40,
  6: 0.30,
  7: 0.20,
}

const DRAFT_CAPITAL_UDFA = 0.10

const DYNASTY_VALUE_BY_ROUND: Record<number, { min: number; max: number }> = {
  1: { min: 8000, max: 10000 },
  2: { min: 5500, max: 7999 },
  3: { min: 3500, max: 5499 },
  4: { min: 2000, max: 3499 },
  5: { min: 1000, max: 1999 },
  6: { min: 500, max: 999 },
  7: { min: 200, max: 499 },
}

export function computeRecruitingComposite(player: DevyPlayer): number {
  if (player.recruitingComposite != null && player.recruitingComposite > 0) {
    return player.recruitingComposite
  }

  if (player.recruitingStars != null && player.recruitingStars > 0) {
    const starMap: Record<number, number> = { 5: 0.98, 4: 0.90, 3: 0.82, 2: 0.70, 1: 0.55 }
    return starMap[player.recruitingStars] || 0.70
  }

  if (player.recruitingRanking != null && player.recruitingRanking > 0) {
    if (player.recruitingRanking <= 50) return 0.97
    if (player.recruitingRanking <= 100) return 0.94
    if (player.recruitingRanking <= 200) return 0.90
    if (player.recruitingRanking <= 300) return 0.85
    return Math.max(0.60, 0.85 - (player.recruitingRanking - 300) * 0.001)
  }

  return 0.75
}

export function computeProductionIndex(player: DevyPlayer): number {
  const pos = player.position
  let score = 0

  if (pos === 'QB') {
    const yardScore = Math.min(100, ((player.passingYards || 0) / 4000) * 100)
    const tdScore = Math.min(100, ((player.passingTDs || 0) / 35) * 100)
    const rushBonus = Math.min(20, ((player.rushingYards || 0) / 500) * 20)
    score = yardScore * 0.45 + tdScore * 0.40 + rushBonus * 0.15
  } else if (pos === 'RB') {
    const rushScore = Math.min(100, ((player.rushingYards || 0) / 1500) * 100)
    const tdScore = Math.min(100, ((player.rushingTDs || 0) / 15) * 100)
    const recBonus = Math.min(25, ((player.receptions || 0) / 40) * 25)
    score = rushScore * 0.45 + tdScore * 0.35 + recBonus * 0.20
  } else if (pos === 'WR') {
    const recYards = Math.min(100, ((player.receivingYards || 0) / 1300) * 100)
    const recTds = Math.min(100, ((player.receivingTDs || 0) / 12) * 100)
    const recCount = Math.min(25, ((player.receptions || 0) / 80) * 25)
    score = recYards * 0.45 + recTds * 0.35 + recCount * 0.20
  } else if (pos === 'TE') {
    const recYards = Math.min(100, ((player.receivingYards || 0) / 800) * 100)
    const recTds = Math.min(100, ((player.receivingTDs || 0) / 8) * 100)
    const recCount = Math.min(25, ((player.receptions || 0) / 50) * 25)
    score = recYards * 0.45 + recTds * 0.35 + recCount * 0.20
  }

  return Math.round(Math.min(100, Math.max(0, score)) * 100) / 100
}

export function computeBreakoutAge(player: DevyPlayer): number | null {
  if (player.breakoutAge != null) return player.breakoutAge
  if (!player.classYear || !player.statSeason) return null

  const pos = player.position
  let hasBreakout = false

  if (pos === 'WR' || pos === 'TE') {
    hasBreakout = (player.receivingYards || 0) > 600 || (player.receivingTDs || 0) >= 5
  } else if (pos === 'RB') {
    hasBreakout = (player.rushingYards || 0) > 700 || (player.rushingTDs || 0) >= 6
  } else if (pos === 'QB') {
    hasBreakout = (player.passingYards || 0) > 2500 || (player.passingTDs || 0) >= 18
  }

  if (!hasBreakout) return null

  const estimatedAge = 18 + (player.classYear || 1) + (player.redshirtStatus ? 1 : 0)
  return estimatedAge
}

export function breakoutAgeToScore(breakoutAge: number | null): number {
  if (breakoutAge === null) return 50
  if (breakoutAge <= 19.5) return 95
  if (breakoutAge <= 20) return 90
  if (breakoutAge <= 20.5) return 85
  if (breakoutAge <= 21) return 80
  if (breakoutAge <= 21.5) return 70
  if (breakoutAge <= 22) return 55
  return Math.max(20, 55 - (breakoutAge - 22) * 15)
}

export function computeAthleticProfileScore(player: DevyPlayer): number {
  if (player.athleticProfileScore != null) return player.athleticProfileScore

  let score = 50
  const pos = player.position

  if (player.heightInches && player.weightLbs) {
    const idealProfiles: Record<string, { height: number; weight: number }> = {
      QB: { height: 75, weight: 220 },
      RB: { height: 71, weight: 215 },
      WR: { height: 73, weight: 205 },
      TE: { height: 77, weight: 250 },
    }
    const ideal = idealProfiles[pos] || idealProfiles.WR

    const heightDiff = Math.abs(player.heightInches - ideal.height)
    const weightDiff = Math.abs(player.weightLbs - ideal.weight)

    score = 80 - heightDiff * 3 - weightDiff * 0.3

    if (pos === 'WR' && player.heightInches >= 74 && player.weightLbs >= 200) score += 10
    if (pos === 'TE' && player.heightInches >= 77 && player.weightLbs >= 245) score += 10
    if (pos === 'RB' && player.heightInches >= 70 && player.weightLbs >= 210 && player.weightLbs <= 225) score += 10
    if (pos === 'QB' && player.heightInches >= 75) score += 8
  }

  return Math.round(Math.min(100, Math.max(10, score)) * 100) / 100
}

export function computeDraftCapitalScore(projectedRound: number | null): number {
  if (!projectedRound || projectedRound < 1) return 30
  const multiplier = DRAFT_CAPITAL_MULTIPLIERS[projectedRound] ?? DRAFT_CAPITAL_UDFA
  return Math.round(multiplier * 100)
}

export function estimateProjectedDraftRound(player: DevyPlayer): number {
  if (player.projectedDraftRound != null && player.projectedDraftRound > 0) return player.projectedDraftRound

  const recruiting = computeRecruitingComposite(player)
  const production = computeProductionIndex(player)
  const yearsLeft = Math.max(0, (player.draftEligibleYear || 2028) - new Date().getFullYear())

  let score = recruiting * 40 + (production / 100) * 40

  if (yearsLeft <= 1) score += 10
  else if (yearsLeft === 2) score += 5

  if (player.classYear && player.classYear <= 2) score += 5

  if (score >= 85) return 1
  if (score >= 72) return 2
  if (score >= 60) return 3
  if (score >= 48) return 4
  if (score >= 36) return 5
  if (score >= 25) return 6
  return 7
}

export function estimateProjectedDraftPick(round: number): number {
  if (round === 1) return 16
  if (round === 2) return 48
  return round * 32 - 16
}

export function computeNilImpactScore(player: DevyPlayer): number {
  if (player.nilImpactScore != null) return player.nilImpactScore

  let impact = 0

  if (player.transferStatus) {
    const eliteSchools = new Set(['Alabama', 'Ohio State', 'Georgia', 'Texas', 'USC', 'Oregon', 'Michigan', 'Penn State', 'LSU', 'Clemson'])
    if (eliteSchools.has(player.school)) {
      impact += 5
    } else {
      impact -= 3
    }
  }

  const recruiting = computeRecruitingComposite(player)
  if (recruiting >= 0.95) impact += 5
  else if (recruiting >= 0.90) impact += 3

  return Math.round(Math.min(100, Math.max(-20, impact)) * 100) / 100
}

export function computeInjurySeverityScore(player: DevyPlayer): number {
  if (player.injurySeverityScore != null) return player.injurySeverityScore

  let score = 0

  if (player.redshirtStatus) {
    if (player.classYear && player.classYear >= 3) {
      score += 15
    } else {
      score += 5
    }
  }

  return Math.round(Math.min(100, Math.max(0, score)))
}

export function computeVolatilityScore(player: DevyPlayer): number {
  if (player.volatilityScore != null) return player.volatilityScore

  let volatility = 30

  if (player.transferStatus) volatility += 15
  if (player.redshirtStatus && player.classYear && player.classYear >= 3) volatility += 20

  const injuryScore = computeInjurySeverityScore(player)
  if (injuryScore > 50) volatility += 20
  else if (injuryScore > 25) volatility += 10

  const yearsOut = Math.max(0, (player.draftEligibleYear || 2028) - new Date().getFullYear())
  volatility += yearsOut * 5

  return Math.round(Math.min(100, Math.max(0, volatility)))
}

export function computeDraftProjectionScore(player: DevyPlayer): number {
  const recruitingRaw = computeRecruitingComposite(player) * 100
  const productionRaw = computeProductionIndex(player)
  const breakoutAge = computeBreakoutAge(player)
  const breakoutScore = breakoutAgeToScore(breakoutAge)
  const athleticScore = computeAthleticProfileScore(player)
  const projectedRound = estimateProjectedDraftRound(player)
  const draftCapital = computeDraftCapitalScore(projectedRound)

  const dps =
    recruitingRaw * 0.25 +
    productionRaw * 0.30 +
    breakoutScore * 0.15 +
    athleticScore * 0.15 +
    draftCapital * 0.15

  return Math.round(Math.min(100, Math.max(0, dps)) * 100) / 100
}

export function computeAllDevyIntelMetrics(player: DevyPlayer): DevyIntelMetrics {
  const recruiting = computeRecruitingComposite(player)
  const production = computeProductionIndex(player)
  const breakoutAge = computeBreakoutAge(player)
  const breakoutScore = breakoutAgeToScore(breakoutAge)
  const athletic = computeAthleticProfileScore(player)
  const projectedRound = estimateProjectedDraftRound(player)
  const projectedPick = estimateProjectedDraftPick(projectedRound)
  const draftCapital = computeDraftCapitalScore(projectedRound)
  const nil = computeNilImpactScore(player)
  const injury = computeInjurySeverityScore(player)
  const volatility = computeVolatilityScore(player)

  const dps =
    (recruiting * 100) * 0.25 +
    production * 0.30 +
    breakoutScore * 0.15 +
    athletic * 0.15 +
    draftCapital * 0.15

  return {
    recruitingComposite: recruiting,
    productionIndex: production,
    breakoutAge,
    breakoutAgeScore: breakoutScore,
    athleticProfileScore: athletic,
    draftCapitalScore: draftCapital,
    draftProjectionScore: Math.round(Math.min(100, Math.max(0, dps)) * 100) / 100,
    projectedDraftRound: projectedRound,
    projectedDraftPick: projectedPick,
    nilImpactScore: nil,
    injurySeverityScore: injury,
    volatilityScore: volatility,
  }
}

export function computeDevyFinalScore(
  player: DevyPlayer,
  opts: {
    biggestNeed: string
    secondaryNeed?: string
    isSF?: boolean
    isTEP?: boolean
    totalTeams?: number
    pickNumber?: number
  }
): DevyFinalScore {
  const metrics = computeAllDevyIntelMetrics(player)

  const draftProjectionComponent = metrics.draftProjectionScore * 0.40

  const currentAdp = player.devyAdp
  let adpMarketComponent = 50
  if (currentAdp != null && currentAdp > 0) {
    adpMarketComponent = Math.max(0, Math.min(100, 100 - (currentAdp - 1) * 3))
  } else {
    adpMarketComponent = metrics.draftProjectionScore * 0.7
  }
  adpMarketComponent *= 0.20

  let needMultiplier = 0.3
  if (player.position === opts.biggestNeed) needMultiplier = 1.0
  else if (player.position === opts.secondaryNeed) needMultiplier = 0.7

  if (opts.isSF && player.position === 'QB') needMultiplier = Math.max(needMultiplier, 0.85)
  if (opts.isTEP && player.position === 'TE') needMultiplier = Math.max(needMultiplier, 0.6)

  const leagueNeedComponent = (needMultiplier * 100) * 0.20

  const teams = opts.totalTeams || 12
  const positionCounts: Record<string, number> = { QB: 4, RB: 8, WR: 10, TE: 4 }
  const posSupply = positionCounts[player.position] || 6
  const scarcityRaw = Math.max(0, 100 - (posSupply / teams) * 100)
  const projectedRound = metrics.projectedDraftRound
  if (projectedRound <= 1) {
    // top prospects scarcer
  }
  const scarcityComponent = Math.min(100, scarcityRaw + (projectedRound <= 2 ? 20 : 0)) * 0.10

  const volatilityComponent = (100 - metrics.volatilityScore) * 0.10

  const finalScore = draftProjectionComponent + adpMarketComponent + leagueNeedComponent + scarcityComponent + volatilityComponent

  return {
    finalScore: Math.round(Math.min(100, Math.max(0, finalScore)) * 100) / 100,
    draftProjectionComponent: Math.round(draftProjectionComponent * 100) / 100,
    adpMarketComponent: Math.round(adpMarketComponent * 100) / 100,
    leagueNeedComponent: Math.round(leagueNeedComponent * 100) / 100,
    scarcityComponent: Math.round(scarcityComponent * 100) / 100,
    volatilityComponent: Math.round(volatilityComponent * 100) / 100,
  }
}

export function computeDevyDynastyValue(player: DevyPlayer, teamDirection: 'Contender' | 'Rebuilder'): number {
  const metrics = computeAllDevyIntelMetrics(player)
  const round = metrics.projectedDraftRound
  const rangeForRound = DYNASTY_VALUE_BY_ROUND[round] || { min: 100, max: 199 }

  const positionInRound = (metrics.draftProjectionScore / 100)
  let dynastyValue = rangeForRound.min + (rangeForRound.max - rangeForRound.min) * positionInRound

  const yearsOut = Math.max(0, (player.draftEligibleYear || 2028) - new Date().getFullYear())

  if (teamDirection === 'Contender') {
    dynastyValue *= Math.max(0.5, 1 - yearsOut * 0.15)
  } else {
    dynastyValue *= Math.min(1.3, 1 + yearsOut * 0.08)
  }

  if (metrics.volatilityScore > 60) dynastyValue *= 0.85
  if (metrics.injurySeverityScore > 50) dynastyValue *= 0.90

  return Math.round(dynastyValue)
}

export function computeDevyAcceptDrivers(
  player: DevyPlayer,
  partnerArchetype: string | null,
  leagueLdiPick: number | null
): { driver: string; delta: number; direction: 'boost' | 'penalty' }[] {
  const drivers: { driver: string; delta: number; direction: 'boost' | 'penalty' }[] = []
  const metrics = computeAllDevyIntelMetrics(player)

  if (partnerArchetype === 'FutureFocused' || partnerArchetype === 'future_focused') {
    drivers.push({ driver: 'Partner loves youth/future assets', delta: 0.08, direction: 'boost' })
  }

  if (leagueLdiPick != null && leagueLdiPick > 65) {
    drivers.push({ driver: 'League heavily invests in draft capital', delta: 0.05, direction: 'boost' })
  }

  const breakoutAge = computeBreakoutAge(player)
  if (breakoutAge != null && breakoutAge <= 20) {
    drivers.push({ driver: `Early breakout age (${breakoutAge})`, delta: 0.03, direction: 'boost' })
  }

  if (metrics.projectedDraftRound <= 1) {
    drivers.push({ driver: 'Projected Round 1 NFL pick', delta: 0.06, direction: 'boost' })
  } else if (metrics.projectedDraftRound <= 2) {
    drivers.push({ driver: 'Projected Day 1-2 NFL pick', delta: 0.03, direction: 'boost' })
  }

  if (metrics.injurySeverityScore > 70) {
    drivers.push({ driver: 'Significant injury concern', delta: 0.07, direction: 'penalty' })
  } else if (metrics.injurySeverityScore > 40) {
    drivers.push({ driver: 'Moderate injury risk', delta: 0.03, direction: 'penalty' })
  }

  if (metrics.volatilityScore > 70) {
    drivers.push({ driver: 'High volatility prospect', delta: 0.04, direction: 'penalty' })
  }

  return drivers
}

export function computeAvailabilityPctV2(
  player: DevyPlayer,
  pickNumber: number,
  totalTeams: number
): number {
  const metrics = computeAllDevyIntelMetrics(player)
  const adp = player.devyAdp

  let baseAvailability: number

  if (adp != null && adp > 0) {
    const adpPosition = adp / totalTeams
    if (pickNumber <= adp) {
      baseAvailability = Math.min(95, 50 + (adp - pickNumber) * 5)
    } else {
      baseAvailability = Math.max(5, 50 - (pickNumber - adp) * 8)
    }
  } else {
    const valuePercentile = Math.min(1, metrics.draftProjectionScore / 100)
    baseAvailability = (1 - valuePercentile) * 80 + 10
  }

  const yearsOut = Math.max(0, (player.draftEligibleYear || 2028) - new Date().getFullYear())
  if (yearsOut >= 2) baseAvailability = Math.min(95, baseAvailability + 10)
  else if (yearsOut === 0) baseAvailability = Math.max(5, baseAvailability - 15)

  const positionRunPenalty = metrics.projectedDraftRound <= 1 ? 10 : 0
  baseAvailability -= positionRunPenalty

  return Math.round(Math.min(95, Math.max(5, baseAvailability)))
}

export async function enrichDevyWithAnalytics(player: DevyPlayer): Promise<DevyPlayer> {
  try {
    const analytics = await getPlayerAnalytics(player.name)
    if (!analytics) return player

    const enriched = { ...player }

    if (enriched.breakoutAge == null && analytics.college.breakoutAge != null) {
      enriched.breakoutAge = analytics.college.breakoutAge
    }

    if (enriched.athleticProfileScore == null && analytics.combine.athleticismScore != null) {
      const rawScore = analytics.combine.athleticismScore
      enriched.athleticProfileScore = Math.round(Math.min(100, Math.max(10, (rawScore / 140) * 100)) * 100) / 100
    }

    if (enriched.heightInches == null && analytics.physical.heightIn != null) {
      enriched.heightInches = analytics.physical.heightIn
    }
    if (enriched.weightLbs == null && analytics.physical.weightLb != null) {
      enriched.weightLbs = analytics.physical.weightLb
    }

    if (enriched.nflDraftRound == null && analytics.draft.draftYear != null && analytics.draft.draftPick != null) {
      const pick = analytics.draft.draftPick
      if (pick <= 32) enriched.nflDraftRound = 1
      else if (pick <= 64) enriched.nflDraftRound = 2
      else if (pick <= 100) enriched.nflDraftRound = 3
      else if (pick <= 135) enriched.nflDraftRound = 4
      else if (pick <= 176) enriched.nflDraftRound = 5
      else if (pick <= 220) enriched.nflDraftRound = 6
      else enriched.nflDraftRound = 7
    }

    return enriched
  } catch {
    return player
  }
}

export async function getPlayerComparables(name: string): Promise<string[]> {
  try {
    const analytics = await getPlayerAnalytics(name)
    return analytics?.comparablePlayers || []
  } catch {
    return []
  }
}

export async function getPlayerCombineProfile(name: string): Promise<{
  fortyYardDash: number | null
  benchPress: number | null
  broadJump: number | null
  verticalJump: number | null
  threeConeDrill: number | null
  twentyYardShuttle: number | null
  athleticismScore: number | null
  speedScore: number | null
  burstScore: number | null
  agilityScore: number | null
  sparqX: number | null
  armLength: number | null
  handSize: number | null
  throwVelocity: number | null
} | null> {
  try {
    const analytics = await getPlayerAnalytics(name)
    if (!analytics) return null
    return {
      fortyYardDash: analytics.combine.fortyYardDash,
      benchPress: analytics.combine.benchPress,
      broadJump: analytics.combine.broadJump,
      verticalJump: analytics.combine.verticalJump,
      threeConeDrill: analytics.combine.threeConeDrill,
      twentyYardShuttle: analytics.combine.twentyYardShuttle,
      athleticismScore: analytics.combine.athleticismScore,
      speedScore: analytics.combine.speedScore,
      burstScore: analytics.combine.burstScore,
      agilityScore: analytics.combine.agilityScore,
      sparqX: analytics.combine.sparqX,
      armLength: analytics.physical.armLengthIn,
      handSize: analytics.physical.handSizeIn,
      throwVelocity: analytics.physical.throwVelocityMph,
    }
  } catch {
    return null
  }
}
