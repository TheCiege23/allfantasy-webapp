// lib/trade-engine/autoCounter.ts
// Auto-counter generation on trade rejection

import { Asset, TradeCandidate } from './types'

export type RejectionReason = 'value' | 'need_mismatch' | 'unknown'

export type CounterOffer = {
  originalTradeId: string
  addedAssets: Asset[]
  removedAssets: Asset[]
  newFairnessScore: number
  newValueRatio: number
  explanation: string
}

export type CounterConfig = {
  maxValueIncrease: number
  maxAssetsAdded: number
  allowCornerstoneAddition: boolean
}

const DEFAULT_COUNTER_CONFIG: CounterConfig = {
  maxValueIncrease: 0.12,
  maxAssetsAdded: 1,
  allowCornerstoneAddition: false,
}

function sumValue(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + (a.value || 0), 0)
}

function validateCounter(
  originalGiveValue: number,
  newGiveValue: number,
  config: CounterConfig,
  addedAssets: Asset[],
  receive: Asset[]
): boolean {
  if (addedAssets.length > config.maxAssetsAdded) return false

  const valueIncrease = (newGiveValue - originalGiveValue) / Math.max(originalGiveValue, 1)
  if (valueIncrease > config.maxValueIncrease) return false

  if (!config.allowCornerstoneAddition && addedAssets.some(a => a.isCornerstone)) return false

  const newValueRatio = sumValue(receive) / Math.max(newGiveValue, 1)
  if (newValueRatio < 0.85 || newValueRatio > 1.25) return false

  return true
}

function computeNewFairness(giveValue: number, receiveValue: number): number {
  const ratio = receiveValue / Math.max(giveValue, 1)
  let score = 50
  if (ratio >= 1 && ratio <= 1.05) score += 30
  else if (ratio >= 0.95 && ratio <= 1.1) score += 15
  else score -= 20
  return Math.max(0, Math.min(100, score))
}

export function generateAutoCounter(
  originalTrade: TradeCandidate,
  rejectionReason: RejectionReason,
  availableAssets: Asset[],
  config: CounterConfig = DEFAULT_COUNTER_CONFIG
): CounterOffer | null {
  const { give, receive, fairnessScore } = originalTrade

  const giveValue = sumValue(give)
  const receiveValue = sumValue(receive)
  const maxAddValue = giveValue * config.maxValueIncrease

  if (rejectionReason === 'value') {
    const eligibleAdds = availableAssets
      .filter(a => {
        if (config.allowCornerstoneAddition === false && a.isCornerstone) return false
        if (a.value > maxAddValue) return false
        if (give.some(g => g.id === a.id)) return false
        return true
      })
      .sort((a, b) => b.value - a.value)

    const bestAdd = eligibleAdds[0]
    if (!bestAdd) return null

    const newGive = [...give, bestAdd]
    const newGiveValue = sumValue(newGive)

    if (!validateCounter(giveValue, newGiveValue, config, [bestAdd], receive)) {
      return null
    }

    const newValueRatio = receiveValue / Math.max(newGiveValue, 1)
    const newFairnessScore = computeNewFairness(newGiveValue, receiveValue)

    return {
      originalTradeId: originalTrade.offerId ?? '',
      addedAssets: [bestAdd],
      removedAssets: [],
      newFairnessScore,
      newValueRatio,
      explanation: `Added ${bestAdd.name} (${bestAdd.value} value) to sweeten the deal`,
    }
  }

  if (rejectionReason === 'need_mismatch') {
    const positions = [...new Set(receive.map(a => a.pos))]
    const swapCandidates = availableAssets
      .filter(a => {
        if (a.isCornerstone && !config.allowCornerstoneAddition) return false
        if (give.some(g => g.id === a.id)) return false
        if (!positions.includes(a.pos)) return false
        return true
      })
      .sort((a, b) => b.value - a.value)

    const swapIn = swapCandidates[0]
    const swapOut = give.find(g => g.pos === swapIn?.pos && !g.isCornerstone)

    if (!swapIn || !swapOut) return null

    const newGive = give.filter(g => g.id !== swapOut.id).concat(swapIn)
    const newGiveValue = sumValue(newGive)

    if (!validateCounter(giveValue, newGiveValue, config, [swapIn], receive)) {
      return null
    }

    const newValueRatio = receiveValue / Math.max(newGiveValue, 1)
    const newFairnessScore = computeNewFairness(newGiveValue, receiveValue)

    return {
      originalTradeId: originalTrade.offerId ?? '',
      addedAssets: [swapIn],
      removedAssets: [swapOut],
      newFairnessScore,
      newValueRatio,
      explanation: `Swapped ${swapOut.name} for ${swapIn.name} to better match their needs`,
    }
  }

  return null
}
