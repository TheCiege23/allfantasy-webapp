// lib/trade-engine/idpTuning.ts
// IDP value tuning by league scoring

import { LeagueContext } from './types'

export type IdpScoringWeights = {
  tackleWeight: number
  sackWeight: number
  intWeight: number
  passDefWeight: number
  forcedFumbleWeight: number
}

export type IdpScarcityIndex = {
  position: string
  startersRequired: number
  replacementPool: number
  scarcityIndex: number
}

const DEFAULT_IDP_WEIGHTS: IdpScoringWeights = {
  tackleWeight: 1.0,
  sackWeight: 4.0,
  intWeight: 6.0,
  passDefWeight: 1.0,
  forcedFumbleWeight: 4.0,
}

export function computeIdpScarcityIndex(
  position: string,
  startersRequired: number,
  totalTeams: number,
  replacementPoolSize: number = 50
): IdpScarcityIndex {
  const totalStarters = startersRequired * totalTeams
  const scarcityIndex = totalStarters / Math.max(replacementPoolSize, 1)

  return {
    position,
    startersRequired,
    replacementPool: replacementPoolSize,
    scarcityIndex,
  }
}

export function getIdpScoringWeight(
  position: string,
  weights: IdpScoringWeights = DEFAULT_IDP_WEIGHTS
): number {
  switch (position.toUpperCase()) {
    case 'LB':
      return weights.tackleWeight * 1.5
    case 'DL':
    case 'EDGE':
      return weights.sackWeight * 1.2
    case 'DB':
      return weights.intWeight * 0.8 + weights.passDefWeight * 0.5
    default:
      return 1.0
  }
}

export function adjustIdpValue(
  baseValue: number,
  position: string,
  scarcityIndex: number,
  weights: IdpScoringWeights = DEFAULT_IDP_WEIGHTS
): number {
  const scoringWeight = getIdpScoringWeight(position, weights)
  const adjustedValue = baseValue * (1 + scarcityIndex * scoringWeight * 0.1)
  return Math.round(adjustedValue)
}

export function computeLeagueIdpScarcity(
  rosterPositions: string[],
  numTeams: number
): IdpScarcityIndex[] {
  const idpPositions = ['DL', 'LB', 'DB', 'EDGE', 'IDP']
  const scarcityList: IdpScarcityIndex[] = []

  for (const pos of idpPositions) {
    const count = rosterPositions.filter(
      rp => rp.toUpperCase() === pos || rp.toUpperCase() === 'IDP_FLEX'
    ).length

    if (count > 0) {
      const poolSize = pos === 'LB' ? 80 : pos === 'DL' ? 60 : pos === 'DB' ? 100 : 50
      scarcityList.push(computeIdpScarcityIndex(pos, count, numTeams, poolSize))
    }
  }

  return scarcityList
}

export function isIdpCornerstone(
  position: string,
  value: number,
  scarcityIndex: number,
  idpEnabled: boolean
): boolean {
  if (!idpEnabled) return false

  const baseThreshold = position === 'LB' ? 4000 : position === 'DL' ? 4500 : 5000
  const adjustedThreshold = baseThreshold / (1 + scarcityIndex * 0.2)

  return value >= adjustedThreshold
}

// Simplified helpers for pipeline integration

export function estimateIdpStarters(rosterPositions: string[]): number {
  const idp = rosterPositions.map(p => p.toUpperCase()).filter(p =>
    p === 'LB' || p === 'DL' || p === 'DB' || p === 'IDP' || p === 'EDGE'
  )
  return idp.length
}

export function deriveIdpScoringWeight(scoring?: Record<string, number>): number {
  if (!scoring) return 0.35

  const tkl = (scoring['idp_tackle'] ?? scoring['tackle'] ?? 0)
  const sack = (scoring['idp_sack'] ?? scoring['sack'] ?? 0)
  const intc = (scoring['idp_int'] ?? scoring['interception'] ?? 0)

  const denom = Math.max(1, sack + intc)
  const ratio = tkl / denom
  if (ratio >= 2.5) return 0.55
  if (ratio >= 1.5) return 0.45
  return 0.35
}

export function adjustIdpValueSimple(
  base: number,
  startersRequired: number,
  poolEstimate: number,
  scoringWeight: number
): number {
  const scarcity = startersRequired / Math.max(poolEstimate, 1)
  const mult = 1 + scarcity * scoringWeight
  return Math.round(base * mult)
}

export function buildIdpConfig(league: LeagueContext) {
  const startersRequired = estimateIdpStarters(league.rosterPositions || [])
  const enabled = startersRequired > 0
  const scoringWeight = deriveIdpScoringWeight(league.scoringSettings)
  const poolEstimate = 250
  return { enabled, startersRequired, poolEstimate, scoringWeight }
}
