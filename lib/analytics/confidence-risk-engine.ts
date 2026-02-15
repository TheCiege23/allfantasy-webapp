import { prisma } from '@/lib/prisma'
import { getVolatilityLabel } from '@/lib/volatility'

export type DecisionCategory = 'trade' | 'waiver' | 'sit_start' | 'trade_proposal' | 'trade_finder'

export type RiskTag =
  | 'aging_asset'
  | 'injury_risk'
  | 'role_uncertainty'
  | 'thin_market'
  | 'position_scarcity'
  | 'future_pick_variance'
  | 'consolidation_risk'
  | 'rb_cliff'
  | 'rookie_unknown'
  | 'qb_dependency'
  | 'schedule_volatility'
  | 'low_data'
  | 'small_sample'
  | 'negative_trend'
  | 'high_value_swing'

export type VolatilityLevel = 'Low' | 'Medium' | 'High'

export type RiskProfile = 'low' | 'moderate' | 'high' | 'extreme'

export interface AssetContext {
  name?: string
  position?: string
  age?: number
  value?: number
  type: 'player' | 'pick'
  pickYear?: number
  pickRound?: number
  isInjured?: boolean
  role?: 'starter' | 'bench' | 'handcuff' | 'unknown'
  weeklyVariance?: number
}

export interface ConfidenceRiskInput {
  category: DecisionCategory
  userId?: string
  leagueId?: string
  assets?: AssetContext[]
  dataCompleteness?: {
    hasHistoricalData?: boolean
    dataPointCount?: number
    playerCoverage?: number
    leagueAge?: number
    isCommonScenario?: boolean
  }
  tradeContext?: {
    valueDelta?: number
    fairnessScore?: number
    riskFlagCount?: number
    assetCount?: number
    winProbShift?: number
  }
  waiverContext?: {
    teamStatus?: string
    suggestionCount?: number
    freeAgentPoolSize?: number
  }
  historicalHitRate?: number | null
}

export interface ConfidenceRiskOutput {
  numericConfidence: number
  confidenceLevel: 'high' | 'learning' | 'evolving'
  confidenceScore01: number
  volatilityScore: number
  volatilityLevel: VolatilityLevel
  riskProfile: RiskProfile
  riskTags: RiskTag[]
  explanation: string
  metadata: {
    dataCompletenessScore: number
    hitRateBonus: number
    volatilityPenalty: number
    riskTagCount: number
    assetCount: number
  }
}

const RISK_TAG_RULES: Array<{
  tag: RiskTag
  check: (input: ConfidenceRiskInput) => boolean
}> = [
  {
    tag: 'aging_asset',
    check: (i) => (i.assets || []).some(a => a.type === 'player' && (a.age ?? 0) >= 30),
  },
  {
    tag: 'rb_cliff',
    check: (i) => (i.assets || []).some(a =>
      a.type === 'player' && a.position === 'RB' && (a.age ?? 0) >= 27
    ),
  },
  {
    tag: 'injury_risk',
    check: (i) => (i.assets || []).some(a => a.isInjured === true),
  },
  {
    tag: 'role_uncertainty',
    check: (i) => (i.assets || []).some(a =>
      a.type === 'player' && (a.role === 'unknown' || a.role === 'handcuff')
    ),
  },
  {
    tag: 'thin_market',
    check: (i) => (i.waiverContext?.freeAgentPoolSize ?? 999) < 15,
  },
  {
    tag: 'position_scarcity',
    check: (i) => {
      const positions = (i.assets || []).filter(a => a.type === 'player').map(a => a.position)
      return positions.includes('TE') || positions.includes('QB')
    },
  },
  {
    tag: 'future_pick_variance',
    check: (i) => {
      const currentYear = new Date().getFullYear()
      return (i.assets || []).some(a =>
        a.type === 'pick' && (a.pickYear ?? currentYear) > currentYear
      )
    },
  },
  {
    tag: 'consolidation_risk',
    check: (i) => (i.tradeContext?.assetCount ?? 0) >= 5,
  },
  {
    tag: 'rookie_unknown',
    check: (i) => (i.assets || []).some(a =>
      a.type === 'player' && (a.age ?? 99) <= 22
    ),
  },
  {
    tag: 'qb_dependency',
    check: (i) => {
      const qbs = (i.assets || []).filter(a => a.position === 'QB' && a.type === 'player')
      return qbs.length > 0 && qbs.some(q => (q.value ?? 0) > 7000)
    },
  },
  {
    tag: 'schedule_volatility',
    check: (i) => (i.assets || []).some(a => (a.weeklyVariance ?? 0) > 8),
  },
  {
    tag: 'low_data',
    check: (i) => (i.dataCompleteness?.playerCoverage ?? 1) < 0.5,
  },
  {
    tag: 'small_sample',
    check: (i) => (i.dataCompleteness?.dataPointCount ?? 999) < 10,
  },
  {
    tag: 'negative_trend',
    check: (i) => (i.tradeContext?.valueDelta ?? 0) < -500,
  },
  {
    tag: 'high_value_swing',
    check: (i) => Math.abs(i.tradeContext?.valueDelta ?? 0) > 3000,
  },
]

function computeDataCompletenessScore(dc: ConfidenceRiskInput['dataCompleteness']): number {
  if (!dc) return 50

  let score = 50

  if (dc.hasHistoricalData) score += 12
  if ((dc.dataPointCount ?? 0) > 100) score += 8
  else if ((dc.dataPointCount ?? 0) > 50) score += 4
  else if ((dc.dataPointCount ?? 0) < 10) score -= 8

  if (dc.isCommonScenario) score += 8

  const coverage = dc.playerCoverage ?? 1
  if (coverage > 0.9) score += 10
  else if (coverage > 0.7) score += 5
  else if (coverage < 0.5) score -= 12

  if ((dc.leagueAge ?? 0) > 3) score += 4
  else if ((dc.leagueAge ?? 0) > 1) score += 2

  return Math.max(10, Math.min(90, score))
}

function computeVolatilityFromAssets(assets: AssetContext[]): number {
  if (assets.length === 0) return 1.0

  let totalWeight = 0
  let weightedVol = 0

  for (const asset of assets) {
    const weight = Math.max(asset.value ?? 1000, 100)
    let vol = 1.0

    if (asset.type === 'pick') {
      const currentYear = new Date().getFullYear()
      const isFuture = (asset.pickYear ?? currentYear) > currentYear
      if (isFuture) vol = 1.2
      else if ((asset.pickRound ?? 1) === 1) vol = 0.95
      else if ((asset.pickRound ?? 1) === 2) vol = 1.1
      else vol = 1.15
    } else {
      const pos = (asset.position ?? '').toUpperCase()
      const age = asset.age ?? 25
      const isAging = age >= 30
      const isYoung = age < 26

      if (pos === 'QB') {
        vol = isAging ? 1.2 : isYoung ? 0.7 : 0.75
      } else if (pos === 'RB') {
        vol = isAging ? 1.5 : age >= 27 ? 1.3 : isYoung ? 1.1 : 1.3
      } else if (pos === 'WR') {
        vol = (asset.value ?? 0) > 6000 ? 0.8 : isAging ? 1.1 : 0.85
      } else if (pos === 'TE') {
        vol = (asset.value ?? 0) > 6000 ? 0.75 : 0.9
      }

      if (asset.isInjured) vol += 0.25
      if (asset.role === 'handcuff' || asset.role === 'unknown') vol += 0.15
    }

    totalWeight += weight
    weightedVol += weight * vol
  }

  if (totalWeight === 0) return 1.0
  return weightedVol / totalWeight
}

function deriveRiskProfile(riskTags: RiskTag[], volatilityLevel: VolatilityLevel): RiskProfile {
  const tagCount = riskTags.length
  const criticalTags: RiskTag[] = ['injury_risk', 'rb_cliff', 'high_value_swing', 'negative_trend']
  const criticalCount = riskTags.filter(t => criticalTags.includes(t)).length

  if (criticalCount >= 2 || (tagCount >= 4 && volatilityLevel === 'High')) return 'extreme'
  if (criticalCount >= 1 || tagCount >= 3 || volatilityLevel === 'High') return 'high'
  if (tagCount >= 1 || volatilityLevel === 'Medium') return 'moderate'
  return 'low'
}

function buildExplanation(output: Omit<ConfidenceRiskOutput, 'explanation'>): string {
  const parts: string[] = []

  if (output.numericConfidence >= 75) {
    parts.push(`Confidence is strong at ${output.numericConfidence}/100 — solid data coverage supports this recommendation.`)
  } else if (output.numericConfidence >= 50) {
    parts.push(`Confidence is moderate at ${output.numericConfidence}/100 — some data gaps may affect accuracy.`)
  } else {
    parts.push(`Confidence is limited at ${output.numericConfidence}/100 — limited data makes this recommendation more speculative.`)
  }

  if (output.volatilityLevel === 'High') {
    parts.push('Volatility is elevated due to the asset profiles involved.')
  } else if (output.volatilityLevel === 'Low') {
    parts.push('Assets involved are relatively stable and predictable.')
  }

  if (output.riskTags.length > 0) {
    const tagDescriptions: Record<RiskTag, string> = {
      aging_asset: 'aging player(s)',
      injury_risk: 'injury concern(s)',
      role_uncertainty: 'unclear player role(s)',
      thin_market: 'thin waiver market',
      position_scarcity: 'scarce position(s) involved',
      future_pick_variance: 'future pick uncertainty',
      consolidation_risk: 'large trade complexity',
      rb_cliff: 'RB age cliff risk',
      rookie_unknown: 'unproven rookie(s)',
      qb_dependency: 'high-value QB dependency',
      schedule_volatility: 'weekly scoring variance',
      low_data: 'limited player data coverage',
      small_sample: 'small historical sample',
      negative_trend: 'negative value trend',
      high_value_swing: 'large value swing',
    }

    const readable = output.riskTags.slice(0, 4).map(t => tagDescriptions[t]).join(', ')
    parts.push(`Risk factors: ${readable}.`)
  }

  return parts.join(' ')
}

export function computeConfidenceRisk(input: ConfidenceRiskInput): ConfidenceRiskOutput {
  const dataScore = computeDataCompletenessScore(input.dataCompleteness)

  let hitRateBonus = 0
  if (input.historicalHitRate != null && input.historicalHitRate > 0) {
    hitRateBonus = Math.round((input.historicalHitRate - 0.5) * 20)
  }

  const assets = input.assets || []
  const volatilityScore = computeVolatilityFromAssets(assets)
  const volatilityLevel = getVolatilityLabel(volatilityScore)

  let volatilityPenalty = 0
  if (volatilityLevel === 'High') {
    volatilityPenalty = -8
  } else if (volatilityLevel === 'Medium') {
    volatilityPenalty = -3
  } else {
    volatilityPenalty = 2
  }

  let contextBonus = 0
  if (input.tradeContext) {
    const tc = input.tradeContext
    if (tc.fairnessScore != null && tc.fairnessScore >= 0.95 && tc.fairnessScore <= 1.05) {
      contextBonus += 5
    }
    if ((tc.riskFlagCount ?? 0) > 2) contextBonus -= 6
    if (tc.winProbShift != null && Math.abs(tc.winProbShift) > 10) contextBonus += 4
  }
  if (input.waiverContext) {
    if ((input.waiverContext.suggestionCount ?? 0) > 3) contextBonus += 3
    if (input.waiverContext.teamStatus === 'REBUILDER') contextBonus -= 2
  }

  let rawConfidence = dataScore + hitRateBonus + volatilityPenalty + contextBonus
  rawConfidence = Math.max(5, Math.min(98, rawConfidence))

  const numericConfidence = Math.round(rawConfidence)

  let confidenceLevel: 'high' | 'learning' | 'evolving'
  if (numericConfidence >= 70) confidenceLevel = 'high'
  else if (numericConfidence >= 45) confidenceLevel = 'learning'
  else confidenceLevel = 'evolving'

  const riskTags: RiskTag[] = []
  for (const rule of RISK_TAG_RULES) {
    try {
      if (rule.check(input)) riskTags.push(rule.tag)
    } catch {
      // skip failed rule
    }
  }

  const riskProfile = deriveRiskProfile(riskTags, volatilityLevel)

  const partial = {
    numericConfidence,
    confidenceLevel,
    confidenceScore01: numericConfidence / 100,
    volatilityScore: Math.round(volatilityScore * 100) / 100,
    volatilityLevel,
    riskProfile,
    riskTags,
    metadata: {
      dataCompletenessScore: dataScore,
      hitRateBonus,
      volatilityPenalty,
      riskTagCount: riskTags.length,
      assetCount: assets.length,
    },
  }

  return {
    ...partial,
    explanation: buildExplanation(partial),
  }
}

export async function getHistoricalHitRate(
  userId?: string,
  category?: DecisionCategory,
  leagueId?: string,
): Promise<number | null> {
  if (!userId) return null

  try {
    const where: Record<string, unknown> = { userId }
    if (category) where.decisionType = category
    if (leagueId) where.leagueId = leagueId

    const logs = await prisma.decisionLog.findMany({
      where: {
        ...where,
        userFollowed: true,
        outcome: { isNot: null },
      },
      include: { outcome: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    })

    if (logs.length < 5) return null

    const positiveOutcomes = logs.filter(
      (l: { outcome: { rosterValueDelta: number | null } | null }) =>
        l.outcome && (l.outcome.rosterValueDelta ?? 0) > 0
    ).length

    return positiveOutcomes / logs.length
  } catch {
    return null
  }
}

export function confidenceRiskForAIPrompt(output: ConfidenceRiskOutput): string {
  const lines = [
    `CONFIDENCE & RISK ASSESSMENT:`,
    `- Confidence: ${output.numericConfidence}/100 (${output.confidenceLevel})`,
    `- Volatility: ${output.volatilityLevel} (score: ${output.volatilityScore})`,
    `- Risk Profile: ${output.riskProfile}`,
  ]

  if (output.riskTags.length > 0) {
    lines.push(`- Risk Tags: ${output.riskTags.join(', ')}`)
  }

  lines.push(`- ${output.explanation}`)

  return lines.join('\n')
}

export function riskTagLabel(tag: RiskTag): string {
  const labels: Record<RiskTag, string> = {
    aging_asset: 'Aging Asset',
    injury_risk: 'Injury Risk',
    role_uncertainty: 'Role Uncertainty',
    thin_market: 'Thin Market',
    position_scarcity: 'Position Scarcity',
    future_pick_variance: 'Future Pick Variance',
    consolidation_risk: 'Consolidation Risk',
    rb_cliff: 'RB Cliff',
    rookie_unknown: 'Rookie Unknown',
    qb_dependency: 'QB Dependency',
    schedule_volatility: 'Schedule Volatility',
    low_data: 'Low Data',
    small_sample: 'Small Sample',
    negative_trend: 'Negative Trend',
    high_value_swing: 'High Value Swing',
  }
  return labels[tag] || tag
}

export function riskTagColor(tag: RiskTag): { bg: string; text: string } {
  const critical: RiskTag[] = ['injury_risk', 'rb_cliff', 'high_value_swing', 'negative_trend']
  const warning: RiskTag[] = ['aging_asset', 'role_uncertainty', 'consolidation_risk', 'qb_dependency', 'future_pick_variance']

  if (critical.includes(tag)) {
    return { bg: 'bg-red-500/15', text: 'text-red-400' }
  }
  if (warning.includes(tag)) {
    return { bg: 'bg-amber-500/15', text: 'text-amber-400' }
  }
  return { bg: 'bg-slate-500/15', text: 'text-slate-400' }
}
