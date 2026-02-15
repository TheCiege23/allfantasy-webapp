import { prisma } from '@/lib/prisma'
import { TradeOutcome } from '@prisma/client'

export type LeagueClass = 'DYN_SF' | 'DYN_1QB' | 'RED_SF' | 'RED_1QB' | 'SPC' | 'UNK'

export interface ComponentWeights {
  market: number
  impact: number
  scarcity: number
  demand: number
}

export interface LearnedWeightsResult {
  leagueClass: LeagueClass
  season: number
  weights: ComponentWeights
  correlations: ComponentWeights
  nTrades: number
  isLearned: boolean
}

const LEAGUE_CLASS_BASELINES: Record<string, ComponentWeights> = {
  DYN_SF:  { market: 0.35, impact: 0.25, scarcity: 0.20, demand: 0.20 },
  DYN_1QB: { market: 0.40, impact: 0.25, scarcity: 0.15, demand: 0.20 },
  RED_SF:  { market: 0.25, impact: 0.45, scarcity: 0.20, demand: 0.10 },
  RED_1QB: { market: 0.20, impact: 0.50, scarcity: 0.20, demand: 0.10 },
  SPC:     { market: 0.10, impact: 0.60, scarcity: 0.25, demand: 0.05 },
  UNK:     { market: 0.35, impact: 0.35, scarcity: 0.15, demand: 0.15 },
}

const USER_GOAL_WEIGHTS: Record<string, ComponentWeights> = {
  win_now:  { market: 0.20, impact: 0.50, scarcity: 0.20, demand: 0.10 },
  rebuild:  { market: 0.50, impact: 0.10, scarcity: 0.20, demand: 0.20 },
  balanced: { market: 0.30, impact: 0.30, scarcity: 0.20, demand: 0.20 },
}

const SMOOTHING_ALPHA = 0.6

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function normalizeWeights(w: ComponentWeights): ComponentWeights {
  const sum = w.market + w.impact + w.scarcity + w.demand
  if (sum === 0) return { market: 0.25, impact: 0.25, scarcity: 0.25, demand: 0.25 }
  return {
    market: w.market / sum,
    impact: w.impact / sum,
    scarcity: w.scarcity / sum,
    demand: w.demand / sum,
  }
}

function correlationFromPairs(xs: number[], ys: (0 | 1)[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 20) return 0

  const meanX = xs.slice(0, n).reduce((s, v) => s + v, 0) / n
  const meanY = ys.slice(0, n).reduce((s: number, v) => s + v, 0) / n

  let cov = 0, varX = 0, varY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  const denom = Math.sqrt(varX * varY)
  if (denom === 0) return 0
  return cov / denom
}

export function getBaselineWeights(leagueClass: string): ComponentWeights {
  return LEAGUE_CLASS_BASELINES[leagueClass] ?? LEAGUE_CLASS_BASELINES.UNK
}

export function getGoalWeights(goal: string): ComponentWeights {
  return USER_GOAL_WEIGHTS[goal] ?? USER_GOAL_WEIGHTS.balanced
}

export function smoothWeights(
  defaultW: ComponentWeights,
  learnedW: ComponentWeights,
  alpha: number = SMOOTHING_ALPHA,
): ComponentWeights {
  return normalizeWeights({
    market: alpha * defaultW.market + (1 - alpha) * learnedW.market,
    impact: alpha * defaultW.impact + (1 - alpha) * learnedW.impact,
    scarcity: alpha * defaultW.scarcity + (1 - alpha) * learnedW.scarcity,
    demand: alpha * defaultW.demand + (1 - alpha) * learnedW.demand,
  })
}

export function applyTFSMultiplier(
  rankScore: number,
  teamFitScore: number,
): number {
  const tfsNorm = teamFitScore / 100
  return rankScore * (1 + 0.15 * (tfsNorm - 0.5))
}

export function applyGoalModifier(
  learnedWeights: ComponentWeights,
  goalWeights: ComponentWeights,
  goalAlpha: number = 0.7,
): ComponentWeights {
  return normalizeWeights({
    market: goalAlpha * learnedWeights.market + (1 - goalAlpha) * goalWeights.market,
    impact: goalAlpha * learnedWeights.impact + (1 - goalAlpha) * goalWeights.impact,
    scarcity: goalAlpha * learnedWeights.scarcity + (1 - goalAlpha) * goalWeights.scarcity,
    demand: goalAlpha * learnedWeights.demand + (1 - goalAlpha) * goalWeights.demand,
  })
}

export function computeUserAdaptiveScore(
  ms: number,
  is: number,
  ss: number,
  ds: number,
  weights: ComponentWeights,
  tfs: number,
): number {
  const raw = weights.market * ms + weights.impact * is + weights.scarcity * ss + weights.demand * ds
  return applyTFSMultiplier(raw, tfs)
}

export function resolveLeagueClass(params: {
  leagueType?: string | null
  specialtyFormat?: string | null
  isSF?: boolean | null
}): LeagueClass {
  const lt = (params.leagueType ?? '').toLowerCase()
  const sfmt = (params.specialtyFormat ?? '').toLowerCase()
  const sf = params.isSF ?? false

  if (sfmt && sfmt !== 'standard') return 'SPC'
  if (lt.includes('dyn')) return sf ? 'DYN_SF' : 'DYN_1QB'
  if (lt.includes('red')) return sf ? 'RED_SF' : 'RED_1QB'
  return 'UNK'
}

export async function learnWeightsFromHistory(
  leagueClass: LeagueClass,
  season: number,
): Promise<LearnedWeightsResult> {
  const baseline = getBaselineWeights(leagueClass)

  const seasonStart = new Date(Date.UTC(season, 0, 1))
  const seasonEnd = new Date(Date.UTC(season + 1, 0, 1))

  const offers = await prisma.tradeOfferEvent.findMany({
    where: {
      createdAt: { gte: seasonStart, lt: seasonEnd },
    },
    select: {
      id: true,
      featuresJson: true,
      leagueFormat: true,
    },
    take: 5000,
  })

  const relevantOffers = offers.filter(o => {
    const fmt = (o.leagueFormat ?? '').toUpperCase()
    if (leagueClass === 'DYN_SF') return fmt.includes('DYN') && fmt.includes('SF')
    if (leagueClass === 'DYN_1QB') return fmt.includes('DYN') && fmt.includes('1QB')
    if (leagueClass === 'RED_SF') return fmt.includes('RED') && fmt.includes('SF')
    if (leagueClass === 'RED_1QB') return fmt.includes('RED') && fmt.includes('1QB')
    if (leagueClass === 'SPC') return fmt.includes('SPC')
    return true
  })

  if (relevantOffers.length === 0) {
    return { leagueClass, season, weights: baseline, correlations: { market: 0, impact: 0, scarcity: 0, demand: 0 }, nTrades: 0, isLearned: false }
  }

  const offerIds = relevantOffers.map(o => o.id)
  const outcomes = await prisma.tradeOutcomeEvent.findMany({
    where: { offerEventId: { in: offerIds } },
    select: { offerEventId: true, outcome: true },
  })
  const outcomeMap = new Map(outcomes.map(o => [o.offerEventId, o.outcome]))

  const marketVals: number[] = []
  const impactVals: number[] = []
  const scarcityVals: number[] = []
  const demandVals: number[] = []
  const ys: (0 | 1)[] = []

  for (const offer of relevantOffers) {
    const out = outcomeMap.get(offer.id)
    if (out !== TradeOutcome.ACCEPTED && out !== TradeOutcome.REJECTED && out !== TradeOutcome.EXPIRED) continue

    const f = (offer.featuresJson ?? {}) as Record<string, any>
    const y: 0 | 1 = out === TradeOutcome.ACCEPTED ? 1 : 0

    marketVals.push(clamp(Number(f.market ?? 0.5), 0, 1))
    impactVals.push(clamp(Number(f.lineupImpact ?? 0.5), 0, 1))
    scarcityVals.push(clamp(Number(f.vorp ?? 0.5), 0, 1))
    demandVals.push(clamp(Number(f.behavior ?? 0.5), 0, 1))
    ys.push(y)
  }

  const nTrades = ys.length

  if (nTrades < 30) {
    return { leagueClass, season, weights: baseline, correlations: { market: 0, impact: 0, scarcity: 0, demand: 0 }, nTrades, isLearned: false }
  }

  const corrMarket = correlationFromPairs(marketVals, ys)
  const corrImpact = correlationFromPairs(impactVals, ys)
  const corrScarcity = correlationFromPairs(scarcityVals, ys)
  const corrDemand = correlationFromPairs(demandVals, ys)

  const rawMarket = Math.max(corrMarket, 0)
  const rawImpact = Math.max(corrImpact, 0)
  const rawScarcity = Math.max(corrScarcity, 0)
  const rawDemand = Math.max(corrDemand, 0)
  const rawSum = rawMarket + rawImpact + rawScarcity + rawDemand

  let learnedWeights: ComponentWeights
  if (rawSum === 0) {
    learnedWeights = baseline
  } else {
    learnedWeights = {
      market: rawMarket / rawSum,
      impact: rawImpact / rawSum,
      scarcity: rawScarcity / rawSum,
      demand: rawDemand / rawSum,
    }
  }

  const finalWeights = smoothWeights(baseline, learnedWeights)

  const correlations = { market: corrMarket, impact: corrImpact, scarcity: corrScarcity, demand: corrDemand }

  await prisma.learnedWeights.upsert({
    where: { leagueClass_season: { leagueClass, season } },
    create: {
      leagueClass,
      season,
      wMarket: finalWeights.market,
      wImpact: finalWeights.impact,
      wScarcity: finalWeights.scarcity,
      wDemand: finalWeights.demand,
      nTrades,
      corrMarket, corrImpact, corrScarcity, corrDemand,
    },
    update: {
      wMarket: finalWeights.market,
      wImpact: finalWeights.impact,
      wScarcity: finalWeights.scarcity,
      wDemand: finalWeights.demand,
      nTrades,
      corrMarket, corrImpact, corrScarcity, corrDemand,
    },
  })

  return { leagueClass, season, weights: finalWeights, correlations, nTrades, isLearned: true }
}

export async function getLearnedWeights(
  leagueClass: LeagueClass,
  season?: number,
): Promise<ComponentWeights> {
  const baseline = getBaselineWeights(leagueClass)

  const where = season
    ? { leagueClass, season }
    : { leagueClass }

  const row = await prisma.learnedWeights.findFirst({
    where,
    orderBy: { season: 'desc' },
  })

  if (!row || row.nTrades < 30) return baseline

  return {
    market: row.wMarket,
    impact: row.wImpact,
    scarcity: row.wScarcity,
    demand: row.wDemand,
  }
}

export async function getWeightEvolution(
  leagueClass: LeagueClass,
): Promise<Array<{ season: number; weights: ComponentWeights; correlations: ComponentWeights; nTrades: number }>> {
  const rows = await prisma.learnedWeights.findMany({
    where: { leagueClass },
    orderBy: { season: 'asc' },
  })

  return rows.map(r => ({
    season: r.season,
    weights: { market: r.wMarket, impact: r.wImpact, scarcity: r.wScarcity, demand: r.wDemand },
    correlations: { market: r.corrMarket, impact: r.corrImpact, scarcity: r.corrScarcity, demand: r.corrDemand },
    nTrades: r.nTrades,
  }))
}

export function blendMultiYearWeights(
  rows: Array<{ season: number; weights: ComponentWeights; nTrades: number }>,
  years: number = 3,
): ComponentWeights {
  const recent = rows.slice(-years)
  const totalTrades = recent.reduce((s, r) => s + r.nTrades, 0)
  if (totalTrades === 0) return LEAGUE_CLASS_BASELINES.UNK

  let wm = 0, wi = 0, ws = 0, wd = 0
  for (const r of recent) {
    const w = r.nTrades / totalTrades
    wm += w * r.weights.market
    wi += w * r.weights.impact
    ws += w * r.weights.scarcity
    wd += w * r.weights.demand
  }

  return normalizeWeights({ market: wm, impact: wi, scarcity: ws, demand: wd })
}
