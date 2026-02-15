// lib/trade-engine/waiverEngine.ts
// Waiver priority scoring using trade engine intelligence

import { Asset, ManagerProfile, LeagueSettings } from './types'

export type WaiverPriority = {
  playerId: string
  playerName: string
  position: string
  priorityScore: number
  needScore: number
  replacementDelta: number
  timingFactor: number
  recommendation: 'Strong Add' | 'Add' | 'Monitor' | 'Skip'
  reasoning: string[]
}

export type WaiverContext = {
  settings: LeagueSettings
  userProfile: ManagerProfile
  userAssets: Asset[]
  availablePlayers: Array<{
    id: string
    name: string
    pos: string
    value: number
    age?: number
  }>
}

function computeNeedScore(pos: string, profile: ManagerProfile): number {
  if (profile.needs.includes(pos)) return 30
  if (profile.surplus.includes(pos)) return -10
  return 10
}

function computeReplacementDelta(
  playerValue: number,
  pos: string,
  assets: Asset[]
): number {
  const samePos = assets.filter(a => a.pos === pos && a.type === 'PLAYER')
  if (samePos.length === 0) return playerValue * 0.5

  const worstStarter = samePos
    .filter(a => a.slot === 'Starter')
    .sort((a, b) => a.value - b.value)[0]

  if (!worstStarter) return playerValue * 0.3

  const delta = playerValue - worstStarter.value
  return Math.max(0, delta * 0.4)
}

function computeTimingFactor(
  contenderTier: ManagerProfile['contenderTier'],
  playerAge: number | undefined,
  playerValue: number
): number {
  const age = playerAge ?? 25

  if (contenderTier === 'contender') {
    if (age <= 24) return 5
    if (playerValue >= 3000) return 15
    return 10
  }

  if (contenderTier === 'rebuild') {
    if (age <= 24) return 20
    if (age >= 28) return -5
    return 5
  }

  return 10
}

export function scoreWaiverPriorities(ctx: WaiverContext): WaiverPriority[] {
  const { userProfile, userAssets, availablePlayers } = ctx

  const priorities: WaiverPriority[] = []

  for (const player of availablePlayers) {
    const needScore = computeNeedScore(player.pos, userProfile)
    const replacementDelta = computeReplacementDelta(player.value, player.pos, userAssets)
    const timingFactor = computeTimingFactor(userProfile.contenderTier, player.age, player.value)

    const priorityScore = needScore + replacementDelta + timingFactor
    const reasoning: string[] = []

    if (needScore >= 20) reasoning.push(`Fills ${player.pos} need`)
    if (replacementDelta >= 10) reasoning.push(`Upgrades over current ${player.pos}`)
    if (timingFactor >= 15) reasoning.push(`Fits ${userProfile.contenderTier} timeline`)

    let recommendation: WaiverPriority['recommendation']
    if (priorityScore >= 50) recommendation = 'Strong Add'
    else if (priorityScore >= 30) recommendation = 'Add'
    else if (priorityScore >= 15) recommendation = 'Monitor'
    else recommendation = 'Skip'

    priorities.push({
      playerId: player.id,
      playerName: player.name,
      position: player.pos,
      priorityScore,
      needScore,
      replacementDelta,
      timingFactor,
      recommendation,
      reasoning,
    })
  }

  return priorities.sort((a, b) => b.priorityScore - a.priorityScore)
}

// ============================================
// SIMPLIFIED WAIVER ENGINE (SNAPSHOT-BASED)
// ============================================

import { LeagueIntelSnapshot } from './types'

export type WaiverSuggestion = {
  add: Asset
  drop?: Asset
  reason: string[]
  score: number
}

export function runWaiverEngine(params: {
  snapshot: LeagueIntelSnapshot
  userRosterId: number
  waiverPool: Asset[]
}): WaiverSuggestion[] {
  const { snapshot, userRosterId, waiverPool } = params
  const profile = snapshot.profilesByRosterId[userRosterId]
  const rosterAssets = snapshot.assetsByRosterId[userRosterId] || []

  if (!profile) return []

  const needs = new Set(profile.needs)
  const candidates = waiverPool
    .filter(a => a.type === 'PLAYER')
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 60)

  const drops = rosterAssets
    .filter(a => a.type === 'PLAYER' && !a.isCornerstone)
    .sort((a, b) => (a.value || 0) - (b.value || 0))

  const out: WaiverSuggestion[] = []
  for (const add of candidates) {
    let score = 50
    const pos = (add.pos || '').toUpperCase()
    if (needs.has(pos)) score += 25
    if (profile.contenderTier === 'contender') score += 10
    if (profile.contenderTier === 'rebuild' && (add.age ?? 30) <= 25) score += 10

    const drop = drops.find(d => (d.pos || '').toUpperCase() === pos) || drops[0]
    if (!drop) continue

    const delta = (add.value || 0) - (drop.value || 0)
    if (delta < 250) continue
    score += Math.min(25, Math.floor(delta / 300))

    out.push({
      add,
      drop,
      score,
      reason: [
        `Upgrade of ~${delta} value at ${pos}.`,
        profile.contenderTier === 'contender' ? 'Win-now bias applied.' : 'Roster-building bias applied.',
      ],
    })
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 15)
}
