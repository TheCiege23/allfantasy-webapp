import type { TradeDecisionContextV1 } from './trade-decision-context'
import type { PeerReviewConsensus } from './trade-analysis-schema'
import type { QualityGateResult } from './quality-gate'

export type FairnessGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F'

export type ValueVerdict = {
  fairnessGrade: FairnessGrade
  edge: string
  edgeSide: 'A' | 'B' | 'Even'
  valueDeltaPercent: number
  valueDeltaAbsolute: number
  sideATotalValue: number
  sideBTotalValue: number
  confidence: number
  vetoRisk: 'None' | 'Low' | 'Moderate' | 'High'
  reasons: string[]
  warnings: string[]
}

export type ViabilityVerdict = {
  acceptanceLikelihood: 'Very Likely' | 'Likely' | 'Uncertain' | 'Unlikely' | 'Very Unlikely'
  acceptanceScore: number
  partnerFit: {
    needsAlignment: string
    surplusMatch: string
    fitScore: number
    details: string[]
  }
  timing: {
    sideAWindow: string
    sideBWindow: string
    timingFit: string
    details: string[]
  }
  leagueActivity: string
  signals: string[]
}

export type ActionPlan = {
  bestOffer: {
    assessment: string
    sendAsIs: boolean
    adjustmentNeeded: string | null
  }
  counters: {
    description: string
    rationale: string
  }[]
  messageText: string
}

export type FormattedTradeResponse = {
  valueVerdict: ValueVerdict
  viabilityVerdict: ViabilityVerdict
  actionPlan: ActionPlan
}

function computeFairnessGrade(pctDiff: number): FairnessGrade {
  if (pctDiff <= 3) return 'A+'
  if (pctDiff <= 7) return 'A'
  if (pctDiff <= 12) return 'B+'
  if (pctDiff <= 18) return 'B'
  if (pctDiff <= 25) return 'C'
  if (pctDiff <= 35) return 'D'
  return 'F'
}

function computeVetoRisk(pctDiff: number): ValueVerdict['vetoRisk'] {
  if (pctDiff <= 8) return 'None'
  if (pctDiff <= 15) return 'Low'
  if (pctDiff <= 25) return 'Moderate'
  return 'High'
}

function computeEdgeLabel(ctx: TradeDecisionContextV1): string {
  const pct = ctx.valueDelta.percentageDiff
  const side = ctx.valueDelta.favoredSide

  if (side === 'Even' || pct <= 3) return 'Dead even'
  if (pct <= 7) return `Slight edge to Side ${side}`
  if (pct <= 15) return `Clear edge to Side ${side} (+${pct}%)`
  if (pct <= 25) return `Strong edge to Side ${side} (+${pct}%)`
  return `Lopsided toward Side ${side} (+${pct}%)`
}

function computeNeedsAlignment(ctx: TradeDecisionContextV1): {
  needsAlignment: string
  surplusMatch: string
  fitScore: number
  details: string[]
} {
  const details: string[] = []
  let fitScore = 50

  const aNeeds = new Set(ctx.sideA.needs.map(n => n.toLowerCase()))
  const bNeeds = new Set(ctx.sideB.needs.map(n => n.toLowerCase()))
  const aSurplus = new Set(ctx.sideA.surplus.map(s => s.toLowerCase()))
  const bSurplus = new Set(ctx.sideB.surplus.map(s => s.toLowerCase()))

  const bAssetsPositions = ctx.sideB.assets.map(a => a.position.toUpperCase())
  const aAssetsPositions = ctx.sideA.assets.map(a => a.position.toUpperCase())

  let aGetsNeeded = 0
  for (const pos of bAssetsPositions) {
    if (aNeeds.has(pos.toLowerCase())) aGetsNeeded++
  }

  let bGetsNeeded = 0
  for (const pos of aAssetsPositions) {
    if (bNeeds.has(pos.toLowerCase())) bGetsNeeded++
  }

  if (aGetsNeeded > 0) {
    details.push(`Side A fills ${aGetsNeeded} roster need${aGetsNeeded > 1 ? 's' : ''} from this trade`)
    fitScore += aGetsNeeded * 10
  }

  if (bGetsNeeded > 0) {
    details.push(`Side B fills ${bGetsNeeded} roster need${bGetsNeeded > 1 ? 's' : ''} from this trade`)
    fitScore += bGetsNeeded * 10
  }

  if (aGetsNeeded === 0 && bGetsNeeded === 0) {
    details.push('Neither side fills a clear positional need')
    fitScore -= 15
  }

  let surplusOverlap = 0
  for (const pos of bAssetsPositions) {
    if (aSurplus.has(pos.toLowerCase())) surplusOverlap++
  }
  for (const pos of aAssetsPositions) {
    if (bSurplus.has(pos.toLowerCase())) surplusOverlap++
  }

  if (surplusOverlap > 0) {
    details.push(`${surplusOverlap} asset${surplusOverlap > 1 ? 's' : ''} being traded from surplus positions — good fit`)
    fitScore += surplusOverlap * 5
  }

  fitScore = Math.max(10, Math.min(100, fitScore))

  const needsLabel = aGetsNeeded > 0 && bGetsNeeded > 0
    ? 'Both sides address roster needs'
    : aGetsNeeded > 0
    ? 'Mostly helps Side A\'s needs'
    : bGetsNeeded > 0
    ? 'Mostly helps Side B\'s needs'
    : 'No clear needs addressed'

  const surplusLabel = surplusOverlap > 0
    ? `${surplusOverlap} asset${surplusOverlap > 1 ? 's' : ''} from surplus positions`
    : 'No surplus-to-need transfers'

  return { needsAlignment: needsLabel, surplusMatch: surplusLabel, fitScore, details }
}

function computeTimingFit(ctx: TradeDecisionContextV1): {
  sideAWindow: string
  sideBWindow: string
  timingFit: string
  details: string[]
} {
  const details: string[] = []
  const tierLabels: Record<string, string> = {
    champion: 'Championship contender',
    contender: 'Playoff contender',
    middle: 'Mid-tier team',
    rebuild: 'Rebuilding',
  }

  const sideAWindow = tierLabels[ctx.sideA.contenderTier] || 'Unknown'
  const sideBWindow = tierLabels[ctx.sideB.contenderTier] || 'Unknown'

  details.push(`Side A: ${sideAWindow}`)
  details.push(`Side B: ${sideBWindow}`)

  const aYoungRatio = ctx.sideA.rosterComposition.youngAssetCount / Math.max(ctx.sideA.assets.length, 1)
  const bYoungRatio = ctx.sideB.rosterComposition.youngAssetCount / Math.max(ctx.sideB.assets.length, 1)

  const aIsContender = ctx.sideA.contenderTier === 'champion' || ctx.sideA.contenderTier === 'contender'
  const bIsContender = ctx.sideB.contenderTier === 'champion' || ctx.sideB.contenderTier === 'contender'
  const aIsRebuilder = ctx.sideA.contenderTier === 'rebuild'
  const bIsRebuilder = ctx.sideB.contenderTier === 'rebuild'

  const bAssetsYoungCount = ctx.sideB.assets.filter(a => a.age != null && a.age <= 25).length
  const aAssetsYoungCount = ctx.sideA.assets.filter(a => a.age != null && a.age <= 25).length
  const bAssetsPrimeCount = ctx.sideB.assets.filter(a => a.age != null && a.age >= 26 && a.age <= 30).length
  const aAssetsPrimeCount = ctx.sideA.assets.filter(a => a.age != null && a.age >= 26 && a.age <= 30).length

  let timingFit = 'Neutral'

  if (aIsContender && bIsRebuilder) {
    if (aAssetsPrimeCount < bAssetsPrimeCount && bAssetsYoungCount < aAssetsYoungCount) {
      timingFit = 'Excellent — contender gets win-now pieces, rebuilder gets youth'
      details.push('Classic contender-to-rebuilder swap aligns with both windows')
    } else {
      timingFit = 'Mixed — team directions favor a deal but assets may not align'
    }
  } else if (bIsContender && aIsRebuilder) {
    if (bAssetsPrimeCount < aAssetsPrimeCount && aAssetsYoungCount < bAssetsYoungCount) {
      timingFit = 'Excellent — contender gets win-now pieces, rebuilder gets youth'
      details.push('Classic contender-to-rebuilder swap aligns with both windows')
    } else {
      timingFit = 'Mixed — team directions favor a deal but assets may not align'
    }
  } else if (aIsContender && bIsContender) {
    timingFit = 'Both competing — could be win-win or zero-sum'
    details.push('Both teams in win-now mode — trade should improve both starting lineups')
  } else if (aIsRebuilder && bIsRebuilder) {
    timingFit = 'Both rebuilding — focus on dynasty asset accumulation'
    details.push('Both teams rebuilding — prioritize long-term upside')
  } else {
    timingFit = 'Neutral timing'
  }

  return { sideAWindow, sideBWindow, timingFit, details }
}

function computeAcceptanceScore(ctx: TradeDecisionContextV1, partnerFitScore: number): {
  score: number
  likelihood: ViabilityVerdict['acceptanceLikelihood']
  signals: string[]
} {
  let score = 50
  const signals: string[] = []

  const pctDiff = ctx.valueDelta.percentageDiff
  if (pctDiff <= 5) {
    score += 15
    signals.push('Very close in value — likely acceptable to both sides')
  } else if (pctDiff <= 10) {
    score += 10
    signals.push('Close enough in value that context could make it fair')
  } else if (pctDiff <= 20) {
    score -= 5
    signals.push('Noticeable value gap — may need sweetener or context justification')
  } else {
    score -= 20
    signals.push('Large value gap — unlikely to be accepted without major adjustments')
  }

  score += Math.round((partnerFitScore - 50) * 0.3)

  if (ctx.sideB.managerPreferences) {
    const prefs = ctx.sideB.managerPreferences
    if (pctDiff <= prefs.fairnessTolerance * 100) {
      score += 10
      signals.push('Within trade partner\'s historical fairness tolerance')
    }
    if (prefs.riskTolerance > 0.6 && ctx.sideA.riskMarkers.some(r => r.ageBucket === 'ascending')) {
      score += 5
      signals.push('Partner has shown willingness to take on upside risk')
    }
  } else {
    signals.push('No trade history available for partner — acceptance harder to predict')
  }

  const tradeFreq = ctx.tradeHistoryStats.leagueTradeFrequency
  if (tradeFreq === 'high') {
    score += 5
    signals.push('Active trading league — deals happen frequently')
  } else if (tradeFreq === 'low') {
    score -= 5
    signals.push('Low-activity league — managers may be resistant to trading')
  }

  score = Math.max(5, Math.min(95, score))

  let likelihood: ViabilityVerdict['acceptanceLikelihood']
  if (score >= 75) likelihood = 'Very Likely'
  else if (score >= 60) likelihood = 'Likely'
  else if (score >= 40) likelihood = 'Uncertain'
  else if (score >= 25) likelihood = 'Unlikely'
  else likelihood = 'Very Unlikely'

  return { score, likelihood, signals }
}

function buildActionPlan(
  gate: QualityGateResult,
  ctx: TradeDecisionContextV1,
  consensus: PeerReviewConsensus,
  acceptanceScore: number
): ActionPlan {
  const pctDiff = ctx.valueDelta.percentageDiff
  const favoredSide = ctx.valueDelta.favoredSide

  let assessment: string
  let sendAsIs = false
  let adjustmentNeeded: string | null = null

  if (pctDiff <= 5) {
    assessment = 'This trade is close enough in value to send as-is. Both sides should feel good about this deal.'
    sendAsIs = true
  } else if (pctDiff <= 12) {
    assessment = `Slightly favors Side ${favoredSide} by ${pctDiff}%. Sendable as-is if roster fit is strong, but a small sweetener could seal the deal.`
    sendAsIs = acceptanceScore >= 60
    if (!sendAsIs) {
      adjustmentNeeded = `Consider adding a late-round pick or depth piece to balance the ${pctDiff}% gap`
    }
  } else if (pctDiff <= 20) {
    assessment = `Noticeable edge to Side ${favoredSide} (+${pctDiff}%). You\'ll likely need to adjust before sending.`
    sendAsIs = false
    adjustmentNeeded = `The ${pctDiff}% value gap needs to be narrowed — add assets to the lighter side or remove from the heavier side`
  } else {
    assessment = `This trade heavily favors Side ${favoredSide} (+${pctDiff}%). It will almost certainly be rejected as-is.`
    sendAsIs = false
    adjustmentNeeded = `Major restructuring needed — the ${pctDiff}% gap is too large for most managers to accept`
  }

  const counters: ActionPlan['counters'] = []
  for (const counter of gate.filteredCounters.slice(0, 2)) {
    counters.push({
      description: counter,
      rationale: 'AI-suggested alternative based on roster needs and value alignment',
    })
  }

  if (counters.length === 0 && pctDiff > 5) {
    if (favoredSide === 'A') {
      counters.push({
        description: `Side A could add a future pick to close the ${pctDiff}% gap`,
        rationale: 'Picks are the easiest way to bridge small value differences',
      })
    } else if (favoredSide === 'B') {
      counters.push({
        description: `Side B could add a future pick to close the ${pctDiff}% gap`,
        rationale: 'Picks are the easiest way to bridge small value differences',
      })
    }
  }

  let messageText: string
  if (sendAsIs) {
    messageText = `Hey, I've been looking at our rosters and I think this trade makes sense for both of us. ${
      ctx.sideA.needs.length > 0 ? `I could use help at ${ctx.sideA.needs.slice(0, 2).join('/')}` : 'It fills some gaps for me'
    }${
      ctx.sideB.needs.length > 0 ? ` and you look like you could use ${ctx.sideB.needs.slice(0, 2).join('/')} depth` : ''
    }. Let me know what you think!`
  } else if (pctDiff <= 15) {
    messageText = `Hey, I've been thinking about a deal. I know the numbers might not be perfectly even, but I think this trade helps both our rosters${
      ctx.sideB.needs.length > 0 ? ` — you get help at ${ctx.sideB.needs.slice(0, 2).join('/')}` : ''
    }. Would you be open to something like this? Happy to tweak it.`
  } else {
    messageText = `Hey, I wanted to float a trade idea to start a conversation. I know this might need some adjustments, but I think there's a deal to be made here${
      ctx.sideB.needs.length > 0 ? ` that addresses your ${ctx.sideB.needs.slice(0, 2).join('/')} needs` : ''
    }. What would make this work for you?`
  }

  return {
    bestOffer: { assessment, sendAsIs, adjustmentNeeded },
    counters,
    messageText,
  }
}

export function formatTradeResponse(
  consensus: PeerReviewConsensus,
  ctx: TradeDecisionContextV1,
  gate: QualityGateResult
): FormattedTradeResponse {
  const partnerFit = computeNeedsAlignment(ctx)
  const timing = computeTimingFit(ctx)
  const { score: acceptanceScore, likelihood, signals } = computeAcceptanceScore(ctx, partnerFit.fitScore)

  const leagueFreq = ctx.tradeHistoryStats.leagueTradeFrequency
  const leagueActivity = leagueFreq === 'high'
    ? `Active league (${ctx.tradeHistoryStats.totalTrades} trades, ${ctx.tradeHistoryStats.recentTrades} in last 30 days)`
    : leagueFreq === 'medium'
    ? `Moderate activity (${ctx.tradeHistoryStats.totalTrades} trades total)`
    : `Low activity league (${ctx.tradeHistoryStats.totalTrades} trades total)`

  return {
    valueVerdict: {
      fairnessGrade: computeFairnessGrade(ctx.valueDelta.percentageDiff),
      edge: computeEdgeLabel(ctx),
      edgeSide: ctx.valueDelta.favoredSide,
      valueDeltaPercent: ctx.valueDelta.percentageDiff,
      valueDeltaAbsolute: ctx.valueDelta.absoluteDiff,
      sideATotalValue: ctx.sideA.totalValue,
      sideBTotalValue: ctx.sideB.totalValue,
      confidence: gate.adjustedConfidence,
      vetoRisk: computeVetoRisk(ctx.valueDelta.percentageDiff),
      reasons: gate.filteredReasons,
      warnings: gate.filteredWarnings,
    },
    viabilityVerdict: {
      acceptanceLikelihood: likelihood,
      acceptanceScore,
      partnerFit,
      timing,
      leagueActivity,
      signals,
    },
    actionPlan: buildActionPlan(gate, ctx, consensus, acceptanceScore),
  }
}
