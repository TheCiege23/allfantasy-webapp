export interface AcceptanceFeatures {
  fairnessScore: number
  ldiAlignment: number
  needsFitScore: number
  archetypeMatch: number
  dealShapeScore: number
  volatilityDelta: number
}

const DEFAULT_WEIGHTS = {
  fairness: 0.8,
  ldi: 0.6,
  needs: 0.7,
  archetype: 0.5,
  dealShape: 0.4,
  volatility: -0.5,
  intercept: -4,
}

export function acceptanceProbability(
  features: AcceptanceFeatures,
  customWeights?: Partial<typeof DEFAULT_WEIGHTS>
): number {
  const w = { ...DEFAULT_WEIGHTS, ...customWeights }

  const z =
    w.fairness * features.fairnessScore +
    w.ldi * features.ldiAlignment +
    w.needs * features.needsFitScore +
    w.archetype * features.archetypeMatch +
    w.dealShape * features.dealShapeScore +
    w.volatility * features.volatilityDelta +
    w.intercept

  const probability = 1 / (1 + Math.exp(-z))

  return Math.max(0.05, Math.min(0.95, probability))
}

export function acceptanceProbabilityWithLiquidity(
  features: AcceptanceFeatures,
  liquidityScore: number,
  customWeights?: Partial<typeof DEFAULT_WEIGHTS>
): { probability: number; liquidityAdjusted: boolean; counterRequired: boolean } {
  const base = acceptanceProbability(features, customWeights)

  const liquidityNorm = liquidityScore / 100
  const adjustment = (liquidityNorm - 0.5) * 0.1

  const adjusted = Math.max(0.05, Math.min(0.95, base + adjustment))

  return {
    probability: adjusted,
    liquidityAdjusted: Math.abs(adjustment) > 0.01,
    counterRequired: adjusted < 0.25 && liquidityNorm < 0.4,
  }
}

export function extractAcceptanceFeatures(tradeDriverData: {
  lineupImpactScore?: number
  vorpScore?: number
  marketScore?: number
  behaviorScore?: number
  acceptProbability?: number
  ldiScore?: number
  needsFitScore?: number
  archetypeMatchScore?: number
  dealShapeScore?: number
}): AcceptanceFeatures {
  const fairness = ((tradeDriverData.lineupImpactScore ?? 50) +
    (tradeDriverData.vorpScore ?? 50) +
    (tradeDriverData.marketScore ?? 50)) / 3

  return {
    fairnessScore: fairness / 10,
    ldiAlignment: (tradeDriverData.ldiScore ?? 50) / 10,
    needsFitScore: (tradeDriverData.needsFitScore ?? 50) / 10,
    archetypeMatch: (tradeDriverData.archetypeMatchScore ?? 50) / 10,
    dealShapeScore: (tradeDriverData.dealShapeScore ?? 50) / 10,
    volatilityDelta: Math.abs(
      (tradeDriverData.lineupImpactScore ?? 50) - (tradeDriverData.marketScore ?? 50)
    ) / 20,
  }
}
