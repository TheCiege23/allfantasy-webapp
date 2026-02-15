// lib/trade-engine/vetoLikelihood.ts
// Deterministic veto risk prediction

import { Asset, ManagerProfile } from './types'

export type VetoLikelihood = 'Low' | 'Medium' | 'High'

export type VetoAnalysis = {
  likelihood: VetoLikelihood
  score: number
  factors: string[]
}

export type VetoContext = {
  fairnessScore: number
  valueRatio: number
  championReceivesCornerstone: boolean
  leagueVetoRate?: number
}

export function computeVetoLikelihood(ctx: VetoContext): VetoAnalysis {
  let score = 0
  const factors: string[] = []

  if (ctx.fairnessScore < 60) {
    score += 30
    factors.push('Low fairness score (<60)')
  }

  if (ctx.championReceivesCornerstone) {
    score += 25
    factors.push('Champion receives cornerstone')
  }

  if (ctx.valueRatio > 1.2 || ctx.valueRatio < 0.85) {
    score += 20
    factors.push('Unbalanced value ratio')
  }

  if (ctx.leagueVetoRate && ctx.leagueVetoRate > 0.2) {
    score += 15
    factors.push('League has high veto history (>20%)')
  }

  const likelihood: VetoLikelihood =
    score < 25 ? 'Low' :
    score <= 50 ? 'Medium' : 'High'

  return { likelihood, score, factors }
}

export function enrichTradeWithVeto<T extends {
  fairnessScore: number
  valueRatio: number
  receive: Asset[]
  toManagerProfile?: ManagerProfile
}>(
  trade: T,
  leagueVetoRate?: number
): T & { vetoAnalysis: VetoAnalysis } {
  const championReceivesCornerstone =
    (trade.toManagerProfile?.isChampion ?? false) &&
    trade.receive.some(a => a.isCornerstone)

  const vetoAnalysis = computeVetoLikelihood({
    fairnessScore: trade.fairnessScore,
    valueRatio: trade.valueRatio,
    championReceivesCornerstone,
    leagueVetoRate,
  })

  return { ...trade, vetoAnalysis }
}
