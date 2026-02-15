// lib/trade-engine/commissionerAlerts.ts
// Commissioner fairness alerts

import { Asset, ManagerProfile, TradeCandidate } from './types'

// Simplified CommishAlert type for pipeline
export type CommishAlert = {
  level: 'info' | 'warning'
  reason: string
  tradeId: string
  fromRosterId: number
  toRosterId: number
}

export function computeCommissionerAlerts(trade: TradeCandidate): CommishAlert[] {
  const out: CommishAlert[] = []
  if (trade.fairnessScore < 50) {
    out.push({
      level: 'warning',
      reason: 'Very low fairness score; potential league integrity risk.',
      tradeId: trade.id || trade.offerId || '',
      fromRosterId: trade.fromRosterId,
      toRosterId: trade.toRosterId,
    })
  }
  if (trade.parityFlags?.length) {
    out.push({
      level: 'info',
      reason: `Parity flags: ${trade.parityFlags.join(', ')}`,
      tradeId: trade.id || trade.offerId || '',
      fromRosterId: trade.fromRosterId,
      toRosterId: trade.toRosterId,
    })
  }
  return out
}

export type AlertType = 'info' | 'warning'

export type CommissionerAlert = {
  alertType: AlertType
  code: string
  message: string
  tradeId: string
  timestamp: Date
}

export type AlertContext = {
  tradeId: string
  fairnessScore: number
  championGainsCornerstone: boolean
  championStarterStrengthDelta: number
  cornerstoneTradedWithoutPremium: boolean
}

export function evaluateCommissionerAlerts(ctx: AlertContext): CommissionerAlert[] {
  const alerts: CommissionerAlert[] = []
  const now = new Date()

  if (ctx.fairnessScore < 50) {
    alerts.push({
      alertType: 'warning',
      code: 'LOW_FAIRNESS',
      message: `Trade has fairness score of ${ctx.fairnessScore}. Consider reviewing for potential imbalance.`,
      tradeId: ctx.tradeId,
      timestamp: now,
    })
  }

  if (ctx.championStarterStrengthDelta > 20) {
    alerts.push({
      alertType: 'warning',
      code: 'CHAMPION_BOOST',
      message: `Champion gains >20% starter strength. This may affect league parity.`,
      tradeId: ctx.tradeId,
      timestamp: now,
    })
  }

  if (ctx.cornerstoneTradedWithoutPremium) {
    alerts.push({
      alertType: 'info',
      code: 'CORNERSTONE_UNDERVALUE',
      message: `Cornerstone traded without premium compensation. May be intentional rebuild move.`,
      tradeId: ctx.tradeId,
      timestamp: now,
    })
  }

  if (ctx.championGainsCornerstone && ctx.fairnessScore < 70) {
    alerts.push({
      alertType: 'warning',
      code: 'CHAMPION_CORNERSTONE',
      message: `Champion acquiring cornerstone in unbalanced trade. Review recommended.`,
      tradeId: ctx.tradeId,
      timestamp: now,
    })
  }

  return alerts
}

export function buildAlertContext(
  tradeId: string,
  fairnessScore: number,
  give: Asset[],
  receive: Asset[],
  fromProfile: ManagerProfile,
  toProfile: ManagerProfile,
  starterStrengthBefore: number,
  starterStrengthAfter: number
): AlertContext {
  const championGainsCornerstone =
    toProfile.isChampion && receive.some(a => a.isCornerstone)

  const cornerstoneTradedWithoutPremium =
    give.some(a => a.isCornerstone) &&
    !receive.some(a => a.isCornerstone) &&
    fairnessScore < 75

  const championStarterStrengthDelta =
    toProfile.isChampion
      ? ((starterStrengthAfter - starterStrengthBefore) / Math.max(starterStrengthBefore, 1)) * 100
      : 0

  return {
    tradeId,
    fairnessScore,
    championGainsCornerstone,
    championStarterStrengthDelta,
    cornerstoneTradedWithoutPremium,
  }
}
