import type { TradeDecisionContextV1, AssetValuation, PlayerRiskMarker, SourceFreshness } from './trade-decision-context'

export type DeterministicIntelligence = {
  confidence: number
  reasons: string[]
  warnings: string[]
  counterBaselines: string[]
}

function computeDeterministicConfidence(ctx: TradeDecisionContextV1): number {
  let confidence = 50

  const coverage = ctx.dataQuality.coveragePercent
  if (coverage >= 90) confidence += 25
  else if (coverage >= 70) confidence += 18
  else if (coverage >= 50) confidence += 10
  else if (coverage >= 30) confidence += 3
  else confidence -= 10

  const pctDiff = ctx.valueDelta.percentageDiff
  if (pctDiff >= 25) confidence += 12
  else if (pctDiff >= 15) confidence += 8
  else if (pctDiff >= 8) confidence += 4
  else if (pctDiff <= 3) confidence -= 5

  if (ctx.sourceFreshness) {
    confidence += ctx.sourceFreshness.totalConfidencePenalty

    const missingCount =
      ctx.missingData.valuationsMissing.length +
      ctx.missingData.adpMissing.length +
      ctx.missingData.analyticsMissing.length
    const unavailableSources = [
      ctx.sourceFreshness.valuations,
      ctx.sourceFreshness.adp,
      ctx.sourceFreshness.analytics,
    ].filter(s => s.grade === 'unavailable').length
    if (unavailableSources === 0) {
      confidence -= Math.min(missingCount * 3, 15)
    }
  } else {
    const staleCount = [
      ctx.missingData.injuryDataStale,
      ctx.missingData.valuationDataStale,
      ctx.missingData.adpDataStale,
      ctx.missingData.analyticsDataStale,
      ctx.missingData.tradeHistoryStale,
    ].filter(Boolean).length
    confidence -= staleCount * 4

    const missingCount =
      ctx.missingData.valuationsMissing.length +
      ctx.missingData.adpMissing.length +
      ctx.missingData.analyticsMissing.length
    confidence -= Math.min(missingCount * 3, 15)
  }

  if (ctx.missingData.managerTendenciesUnavailable.length > 0) confidence -= 3
  if (ctx.missingData.competitorDataUnavailable) confidence -= 2
  if (ctx.missingData.tradeHistoryInsufficient) confidence -= 3

  if (ctx.dataQuality.injuryDataAvailable) confidence += 3
  if (ctx.dataQuality.adpHitRate >= 0.8) confidence += 3

  return Math.max(15, Math.min(90, Math.round(confidence)))
}

function formatValue(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v.toFixed(0)
}

function buildDeterministicReasons(ctx: TradeDecisionContextV1): string[] {
  const reasons: string[] = []
  const pctDiff = ctx.valueDelta.percentageDiff
  const favored = ctx.valueDelta.favoredSide

  if (favored === 'Even' || pctDiff <= 3) {
    reasons.push(
      `Value is essentially even: Side A total ${formatValue(ctx.sideA.totalValue)} vs Side B total ${formatValue(ctx.sideB.totalValue)} (${pctDiff}% gap)`
    )
  } else {
    reasons.push(
      `Side ${favored} has a ${pctDiff}% value edge: ${formatValue(ctx.sideA.totalValue)} (A) vs ${formatValue(ctx.sideB.totalValue)} (B)`
    )
  }

  const topA = [...ctx.sideA.assets].sort((a, b) => b.marketValue - a.marketValue).slice(0, 2)
  const topB = [...ctx.sideB.assets].sort((a, b) => b.marketValue - a.marketValue).slice(0, 2)

  if (topA.length > 0 && topB.length > 0) {
    const aLabels = topA.map(a => `${a.name} (${formatValue(a.marketValue)})`).join(', ')
    const bLabels = topB.map(a => `${a.name} (${formatValue(a.marketValue)})`).join(', ')
    reasons.push(`Key assets — Side A sends: ${aLabels} | Side B sends: ${bLabels}`)
  }

  const aNeeds = new Set(ctx.sideA.needs.map(n => n.toLowerCase()))
  const bNeeds = new Set(ctx.sideB.needs.map(n => n.toLowerCase()))
  let aFilled = 0, bFilled = 0
  for (const asset of ctx.sideB.assets) {
    if (aNeeds.has(asset.position.toLowerCase())) aFilled++
  }
  for (const asset of ctx.sideA.assets) {
    if (bNeeds.has(asset.position.toLowerCase())) bFilled++
  }

  if (aFilled > 0 && bFilled > 0) {
    reasons.push(`Roster fit is strong: Side A fills ${aFilled} need(s), Side B fills ${bFilled} need(s)`)
  } else if (aFilled > 0) {
    reasons.push(`Side A fills ${aFilled} positional need(s) — one-sided roster improvement`)
  } else if (bFilled > 0) {
    reasons.push(`Side B fills ${bFilled} positional need(s) — one-sided roster improvement`)
  }

  const aContender = ctx.sideA.contenderTier === 'champion' || ctx.sideA.contenderTier === 'contender'
  const bContender = ctx.sideB.contenderTier === 'champion' || ctx.sideB.contenderTier === 'contender'
  const aRebuilder = ctx.sideA.contenderTier === 'rebuild'
  const bRebuilder = ctx.sideB.contenderTier === 'rebuild'

  if ((aContender && bRebuilder) || (bContender && aRebuilder)) {
    const contenderSide = aContender ? 'A' : 'B'
    const contenderAssets = aContender ? ctx.sideB.assets : ctx.sideA.assets
    const rebuilderAssets = aContender ? ctx.sideA.assets : ctx.sideB.assets
    const youngCount = contenderAssets.filter(a => a.age != null && a.age <= 25).length
    const primeCount = rebuilderAssets.filter(a => a.age != null && a.age >= 26 && a.age <= 30).length
    if (youngCount > 0 || primeCount > 0) {
      reasons.push(`Contender (Side ${contenderSide}) gets ${primeCount} win-now piece(s), rebuilder gets ${youngCount} young asset(s) — classic window-aligned swap`)
    }
  }

  const allRiskMarkers = [...ctx.sideA.riskMarkers, ...ctx.sideB.riskMarkers]
  const highRiskPlayers = allRiskMarkers.filter(
    r => r.ageBucket === 'cliff' || r.ageBucket === 'declining' ||
    (r.injuryStatus && r.injuryStatus.reinjuryRisk === 'high')
  )
  if (highRiskPlayers.length > 0) {
    const names = highRiskPlayers.slice(0, 3).map(r => {
      const tags: string[] = []
      if (r.ageBucket === 'cliff') tags.push('age cliff')
      else if (r.ageBucket === 'declining') tags.push('declining')
      if (r.injuryStatus?.reinjuryRisk === 'high') tags.push('high reinjury risk')
      return `${r.playerName} (${tags.join(', ')})`
    })
    reasons.push(`Risk factors: ${names.join('; ')}`)
  }

  const cornerstones = [...ctx.sideA.assets, ...ctx.sideB.assets].filter(a => a.isCornerstone)
  if (cornerstones.length > 0) {
    const labels = cornerstones.slice(0, 2).map(c => `${c.name} — ${c.cornerstoneReason}`)
    reasons.push(`Cornerstone asset(s) in play: ${labels.join('; ')}`)
  }

  return reasons
}

function buildDeterministicWarnings(ctx: TradeDecisionContextV1): string[] {
  const warnings: string[] = []

  if (ctx.missingData.valuationsMissing.length > 0) {
    warnings.push(`Missing valuations for: ${ctx.missingData.valuationsMissing.slice(0, 5).join(', ')}`)
  }
  if (ctx.missingData.adpMissing.length > 0) {
    warnings.push(`No ADP data for: ${ctx.missingData.adpMissing.slice(0, 5).join(', ')}`)
  }
  if (ctx.missingData.analyticsMissing.length > 0 && ctx.missingData.analyticsMissing.length >= 3) {
    warnings.push(`Analytics data missing for ${ctx.missingData.analyticsMissing.length} player(s)`)
  }

  if (ctx.sourceFreshness) {
    for (const w of ctx.sourceFreshness.warnings) {
      warnings.push(w)
    }
  } else {
    if (ctx.missingData.valuationDataStale) warnings.push('Player valuations may be outdated (>3 days)')
    if (ctx.missingData.injuryDataStale) warnings.push('Injury reports may be outdated (>7 days)')
    if (ctx.missingData.adpDataStale) warnings.push('ADP rankings may be outdated')
    if (ctx.missingData.tradeHistoryStale) warnings.push('League trade history may be outdated')
  }

  const cliffPlayers = [...ctx.sideA.riskMarkers, ...ctx.sideB.riskMarkers].filter(r => r.ageBucket === 'cliff')
  for (const r of cliffPlayers.slice(0, 3)) {
    warnings.push(`${r.playerName} is at age cliff${r.currentAge ? ` (age ${r.currentAge})` : ''} — value likely to decline sharply`)
  }

  const injuredPlayers = [...ctx.sideA.riskMarkers, ...ctx.sideB.riskMarkers].filter(
    r => r.injuryStatus && r.injuryStatus.status !== 'Healthy' && r.injuryStatus.status !== 'Active'
  )
  for (const r of injuredPlayers.slice(0, 3)) {
    const inj = r.injuryStatus!
    const missedLabel = inj.missedGames != null ? `, est. ${inj.missedGames} games missed` : ''
    warnings.push(`${r.playerName} is ${inj.status}${inj.type ? ` (${inj.type})` : ''}${missedLabel}`)
  }

  if (ctx.missingData.tradeHistoryInsufficient) {
    warnings.push('Limited trade history (<3 trades) — acceptance signals are less reliable')
  }
  if (ctx.missingData.competitorDataUnavailable) {
    warnings.push('No competitor team data available — league context is incomplete')
  }
  if (ctx.missingData.managerTendenciesUnavailable.length > 0) {
    warnings.push(`No trade tendency data for: ${ctx.missingData.managerTendenciesUnavailable.join(', ')}`)
  }

  return warnings
}

function buildDeterministicCounters(ctx: TradeDecisionContextV1): string[] {
  const counters: string[] = []
  const pctDiff = ctx.valueDelta.percentageDiff
  const favored = ctx.valueDelta.favoredSide

  if (pctDiff <= 3 || favored === 'Even') return counters

  const lighterSide = favored === 'A' ? 'B' : 'A'
  const lighterAssets = favored === 'A' ? ctx.sideB : ctx.sideA
  const heavierAssets = favored === 'A' ? ctx.sideA : ctx.sideB

  if (pctDiff <= 15) {
    const lighterPicks = lighterAssets.assets.filter(a => a.type === 'PICK')
    if (lighterPicks.length === 0) {
      counters.push(`Side ${lighterSide} could add a future mid-round pick to close the ${pctDiff}% gap`)
    } else {
      counters.push(`Consider adding a late-round pick from Side ${lighterSide} to balance the ${pctDiff}% difference`)
    }
  } else if (pctDiff <= 25) {
    const heavierBench = heavierAssets.assets
      .filter(a => a.type === 'PLAYER')
      .sort((a, b) => a.marketValue - b.marketValue)
    if (heavierBench.length > 0) {
      const smallestAsset = heavierBench[0]
      counters.push(
        `Removing ${smallestAsset.name} (${formatValue(smallestAsset.marketValue)}) from Side ${favored} would narrow the gap`
      )
    }
    counters.push(`Side ${lighterSide} could add a future 2nd or 3rd round pick to close the ${pctDiff}% gap`)
  } else {
    counters.push(
      `${pctDiff}% gap is too large for minor adjustments — this trade likely needs to be restructured with different core pieces`
    )
  }

  return counters
}

export function buildDeterministicIntelligence(ctx: TradeDecisionContextV1): DeterministicIntelligence {
  return {
    confidence: computeDeterministicConfidence(ctx),
    reasons: buildDeterministicReasons(ctx),
    warnings: buildDeterministicWarnings(ctx),
    counterBaselines: buildDeterministicCounters(ctx),
  }
}
