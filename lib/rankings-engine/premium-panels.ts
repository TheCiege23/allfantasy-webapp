import type { TeamScore } from './league-rankings-v2'

export type Tier = 'Contender' | 'Rising' | 'Mid Pack' | 'Rebuilder' | 'Playoff Threat' | 'Too Early'
export type WinWindowLabel = 'Win Now' | 'Competitive' | 'Rebuilding' | 'Retooling' | 'Flexible'

export function computeTier(team: TeamScore): Tier {
  const ew = team.expectedWins ?? 0
  const marketAdj = team.marketAdj ?? 0
  const bbi = team.bounceBackIndex ?? 0
  const luckDelta = team.luckDelta ?? 0
  const games = team.record.wins + team.record.losses + team.record.ties

  if (games < 3) return 'Too Early'
  if (ew >= 9 && marketAdj > 0) return 'Contender'
  if (bbi >= 70 && luckDelta < -1) return 'Rising'
  if (marketAdj < -10) return 'Rebuilder'
  if (ew >= 7) return 'Playoff Threat'
  return 'Mid Pack'
}

export function computeWinWindow(team: TeamScore): WinWindowLabel {
  const ew = team.expectedWins ?? 0
  const marketAdj = team.marketAdj ?? 0
  const mgrSkill = team.managerSkillScore ?? 0
  const rosterExposure = team.rosterExposure ?? {}
  const pickExposure = rosterExposure['PICK'] ?? 0
  const hasPickHeavy = pickExposure > 0.25

  if (ew >= 9 && marketAdj > 5 && mgrSkill >= 60) return 'Win Now'
  if (ew >= 7 && marketAdj >= 0) return 'Competitive'
  if (hasPickHeavy && marketAdj < -5) return 'Rebuilding'
  if (ew < 5 && marketAdj < 0) return 'Retooling'
  return 'Flexible'
}

export function whatChangedSummary(team: TeamScore) {
  const delta = team.rankDelta ?? 0
  const drivers = team.explanation?.drivers ?? []
  return {
    rankDelta: delta,
    topDrivers: drivers.slice(0, 2).map((d) => ({
      id: d.id,
      polarity: d.polarity,
      impact: d.impact,
      label: d.id,
      confidence: team.explanation?.confidence?.rating ?? 'LEARNING'
    }))
  }
}
