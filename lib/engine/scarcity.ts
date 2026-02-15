import type { EngineLeagueContext, EngineManagerProfile, EnginePlayerState } from './types'

export interface PositionalScarcity {
  position: string
  replacementLevel: number
  scarcityMultiplier: number
  availableStarters: number
  tier: 'abundant' | 'balanced' | 'scarce' | 'desert'
}

const BASE_STARTER_POOL: Record<string, number> = {
  QB: 32,
  RB: 40,
  WR: 48,
  TE: 20,
  K: 32,
  DEF: 32,
}

export function computePositionalScarcity(
  league: EngineLeagueContext,
  allPlayers: EnginePlayerState[]
): Record<string, PositionalScarcity> {
  const { numTeams, roster, scoring } = league
  const result: Record<string, PositionalScarcity> = {}

  const positionCounts: Record<string, number> = {}
  const startersByPos: Record<string, number> = {}

  for (const pos of roster.positions) {
    const normalized = normalizeSlotToPosition(pos)
    if (normalized) {
      startersByPos[normalized] = (startersByPos[normalized] || 0) + 1
    }
  }

  if (scoring.isSF) {
    startersByPos.QB = (startersByPos.QB || 1) + 1
  }

  for (const player of allPlayers) {
    positionCounts[player.position] = (positionCounts[player.position] || 0) + 1
  }

  const positions = ['QB', 'RB', 'WR', 'TE']

  for (const pos of positions) {
    const demandSlots = (startersByPos[pos] || 1) * numTeams
    const pool = BASE_STARTER_POOL[pos] || 32
    const available = Math.max(0, pool - demandSlots)
    const ratio = demandSlots / pool

    let scarcityMultiplier: number
    let tier: PositionalScarcity['tier']

    if (ratio >= 1.2) {
      scarcityMultiplier = 1.3
      tier = 'desert'
    } else if (ratio >= 0.9) {
      scarcityMultiplier = 1.15
      tier = 'scarce'
    } else if (ratio >= 0.6) {
      scarcityMultiplier = 1.0
      tier = 'balanced'
    } else {
      scarcityMultiplier = 0.9
      tier = 'abundant'
    }

    if (pos === 'QB' && scoring.isSF) {
      scarcityMultiplier *= 1.25
    }
    if (pos === 'TE' && scoring.isTEP) {
      scarcityMultiplier *= 1.15
    }

    const sortedValues = allPlayers
      .filter(p => p.position === pos)
      .map(p => p.value.market)
      .sort((a, b) => b - a)

    const replacementIndex = Math.min(demandSlots, sortedValues.length - 1)
    const replacementLevel = sortedValues[replacementIndex] ?? 0

    result[pos] = {
      position: pos,
      replacementLevel,
      scarcityMultiplier: Math.round(scarcityMultiplier * 100) / 100,
      availableStarters: available,
      tier,
    }
  }

  return result
}

export function scarcityAdjustedValue(
  value: number,
  position: string,
  scarcity: Record<string, PositionalScarcity>
): number {
  const posScarcity = scarcity[position]
  if (!posScarcity) return value
  return Math.round(value * posScarcity.scarcityMultiplier)
}

function normalizeSlotToPosition(slot: string): string | null {
  if (slot === 'QB') return 'QB'
  if (slot === 'RB') return 'RB'
  if (slot === 'WR') return 'WR'
  if (slot === 'TE') return 'TE'
  if (slot === 'FLEX' || slot === 'REC_FLEX') return null
  if (slot === 'SUPER_FLEX') return null
  if (slot === 'K') return 'K'
  if (slot === 'DEF') return 'DEF'
  return null
}

export function computeReplacementLevel(
  position: string,
  league: EngineLeagueContext,
  playerValues: number[]
): number {
  const sorted = [...playerValues].sort((a, b) => b - a)
  const demandSlots = league.numTeams * (position === 'RB' || position === 'WR' ? 2 : 1)
  const idx = Math.min(demandSlots, sorted.length - 1)
  return sorted[idx] ?? 0
}
