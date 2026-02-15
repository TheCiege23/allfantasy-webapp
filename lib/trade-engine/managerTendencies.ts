// lib/trade-engine/managerTendencies.ts

export type ManagerTendency = {
  user_id: string
  username?: string
  leagues_played: number
  trades_sent: number
  trades_accepted: number
  avg_overpay_ratio: number
  prefers_youth: boolean
  prefers_picks: boolean
  risk_tolerance: string
  updated_at: Date
}

export function inferTradeAggression(t: ManagerTendency): 'high' | 'medium' | 'low' {
  if (t.trades_sent >= 5 && t.trades_accepted / t.trades_sent > 0.6)
    return 'high'
  if (t.trades_sent >= 3)
    return 'medium'
  return 'low'
}

export function inferRiskTolerance(t: ManagerTendency): 'high' | 'medium' | 'low' {
  if (t.avg_overpay_ratio > 1.12) return 'high'
  if (t.avg_overpay_ratio < 0.95) return 'low'
  return 'medium'
}

// Simplified tendencies type for pipeline
export type Tendencies = {
  tradesSent: number
  tradesAccepted: number
  avgOverpayRatio: number
}

export function inferTradeAggressionSimple(t: Tendencies): 'low' | 'medium' | 'high' {
  if (t.tradesSent >= 8) return 'high'
  if (t.tradesSent >= 3) return 'medium'
  return 'low'
}

export function inferRiskToleranceSimple(t: Tendencies): 'low' | 'medium' | 'high' {
  if (t.avgOverpayRatio > 1.12) return 'high'
  if (t.avgOverpayRatio < 0.95) return 'low'
  return 'medium'
}
