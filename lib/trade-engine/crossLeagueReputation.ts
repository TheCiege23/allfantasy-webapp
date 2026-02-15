// lib/trade-engine/crossLeagueReputation.ts
// Cross-league manager reputation aggregation

export type TraderArchetype = 'Shark' | 'Gambler' | 'Fair Dealer' | 'Taco'

export type ManagerReputation = {
  userId: string
  username?: string
  leaguesPlayed: number
  totalTradesSent: number
  totalTradesAccepted: number
  avgOverpayRatio: number
  cornerstonedTradedAway: number
  championHelpingTrades: number
  archetype: TraderArchetype
  confidenceLevel: 'low' | 'medium' | 'high'
}

export type ReputationInput = {
  userId: string
  username?: string
  leaguesPlayed: number
  tradesSent: number
  tradesAccepted: number
  avgOverpayRatio: number
  cornerstonedTradedAway: number
  championHelpingTrades: number
}

export function computeTraderArchetype(input: ReputationInput): TraderArchetype {
  const acceptRate = input.tradesAccepted / Math.max(input.tradesSent, 1)
  const { avgOverpayRatio, championHelpingTrades, leaguesPlayed } = input

  if (avgOverpayRatio < 0.92 && acceptRate > 0.5) {
    return 'Shark'
  }

  if (avgOverpayRatio > 1.15) {
    return 'Taco'
  }

  const variance = Math.abs(avgOverpayRatio - 1.0)
  if (variance > 0.1 && acceptRate < 0.4) {
    return 'Gambler'
  }

  return 'Fair Dealer'
}

export function computeConfidenceLevel(
  leaguesPlayed: number,
  totalTrades: number
): 'low' | 'medium' | 'high' {
  if (leaguesPlayed >= 3 && totalTrades >= 10) return 'high'
  if (leaguesPlayed >= 2 || totalTrades >= 5) return 'medium'
  return 'low'
}

export function buildManagerReputation(input: ReputationInput): ManagerReputation {
  const archetype = computeTraderArchetype(input)
  const confidenceLevel = computeConfidenceLevel(input.leaguesPlayed, input.tradesSent)

  return {
    userId: input.userId,
    username: input.username,
    leaguesPlayed: input.leaguesPlayed,
    totalTradesSent: input.tradesSent,
    totalTradesAccepted: input.tradesAccepted,
    avgOverpayRatio: input.avgOverpayRatio,
    cornerstonedTradedAway: input.cornerstonedTradedAway,
    championHelpingTrades: input.championHelpingTrades,
    archetype,
    confidenceLevel,
  }
}

export function classifyReputation(r: { avg_value_delta?: number; avgValueDelta?: number }): TraderArchetype {
  const delta = r.avgValueDelta ?? r.avg_value_delta ?? 1.0
  if (delta > 1.12) return 'Shark'
  if (delta < 0.9) return 'Taco'
  return 'Fair Dealer'
}

// Simplified reputation row type for pipeline
export type ReputationRow = {
  userId: string
  tradesSent: number
  tradesAccepted: number
  avgValueDelta: number
}

export function getArchetypeTraits(archetype: TraderArchetype): {
  targetBias: number
  messagingTone: string
  counterAggressiveness: number
} {
  switch (archetype) {
    case 'Shark':
      return {
        targetBias: -10,
        messagingTone: 'Be direct and value-focused. They respect efficiency.',
        counterAggressiveness: 0.8,
      }
    case 'Gambler':
      return {
        targetBias: 5,
        messagingTone: 'Highlight upside and potential. They chase ceiling.',
        counterAggressiveness: 1.0,
      }
    case 'Fair Dealer':
      return {
        targetBias: 10,
        messagingTone: 'Emphasize win-win. They value fairness.',
        counterAggressiveness: 0.5,
      }
    case 'Taco':
      return {
        targetBias: 15,
        messagingTone: 'Keep it simple. Avoid overwhelming with details.',
        counterAggressiveness: 0.3,
      }
  }
}
