import { prisma } from '@/lib/prisma'
import { resolveLeagueClass, type LeagueClass } from './adaptive-weight-learning'
import type { CompositeWeightProfile } from './composite-weights'
import { getCompositeWeightConfig, resolveWeightProfile, computeCompositeFromWeights } from './composite-weights'
import { runBacktestForWeek, type BacktestResult } from './backtest'

export interface LearnedCompositeParams {
  injuryInfluence: number
  starterBenchSplit: number
  luckDampening: number
  futureCapitalInfluence: number
}

const DEFAULT_PARAMS: Record<string, LearnedCompositeParams> = {
  DYN_SF: { injuryInfluence: 0.30, starterBenchSplit: 0.70, luckDampening: 2.0, futureCapitalInfluence: 0.10 },
  DYN_1QB: { injuryInfluence: 0.30, starterBenchSplit: 0.70, luckDampening: 2.0, futureCapitalInfluence: 0.10 },
  RED_SF: { injuryInfluence: 0.30, starterBenchSplit: 0.80, luckDampening: 2.0, futureCapitalInfluence: 0.00 },
  RED_1QB: { injuryInfluence: 0.30, starterBenchSplit: 0.80, luckDampening: 2.0, futureCapitalInfluence: 0.00 },
  SPC: { injuryInfluence: 0.25, starterBenchSplit: 0.75, luckDampening: 2.0, futureCapitalInfluence: 0.05 },
  UNK: { injuryInfluence: 0.30, starterBenchSplit: 0.75, luckDampening: 2.0, futureCapitalInfluence: 0.05 },
}

const PARAM_BOUNDS: Record<keyof LearnedCompositeParams, [number, number]> = {
  injuryInfluence: [0.10, 0.60],
  starterBenchSplit: [0.55, 0.90],
  luckDampening: [1.0, 4.0],
  futureCapitalInfluence: [0.00, 0.25],
}

const MAX_WEEKLY_PARAM_MOVEMENT = 0.03
const MIN_BACKTEST_RESULTS = 5

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function getDefaultCompositeParams(segmentKey: string): LearnedCompositeParams {
  const key = segmentKey.replace(/_inseason|_offseason|_postDraft|_postSeason/, '')
  return DEFAULT_PARAMS[key] ?? DEFAULT_PARAMS.UNK
}

export async function getActiveCompositeParams(segmentKey: string): Promise<LearnedCompositeParams> {
  const baseKey = segmentKey.replace(/_inseason|_offseason|_postDraft|_postSeason/, '')

  try {
    const row = await prisma.rankingWeightsWeekly.findFirst({
      where: {
        segmentKey: { startsWith: baseKey },
        status: 'APPLIED',
        compositeParamsJson: { not: null },
      },
      orderBy: { weekStart: 'desc' },
    })

    if (row?.compositeParamsJson) {
      const params = row.compositeParamsJson as Record<string, number>
      return {
        injuryInfluence: params.injuryInfluence ?? DEFAULT_PARAMS[baseKey]?.injuryInfluence ?? 0.30,
        starterBenchSplit: params.starterBenchSplit ?? DEFAULT_PARAMS[baseKey]?.starterBenchSplit ?? 0.75,
        luckDampening: params.luckDampening ?? DEFAULT_PARAMS[baseKey]?.luckDampening ?? 2.0,
        futureCapitalInfluence: params.futureCapitalInfluence ?? DEFAULT_PARAMS[baseKey]?.futureCapitalInfluence ?? 0.05,
      }
    }
  } catch {}

  return getDefaultCompositeParams(segmentKey)
}

interface ParamCandidate {
  params: LearnedCompositeParams
  score: number
}

export async function learnCompositeParamsFromBacktest(
  segmentKey: string,
  backtestLeagueId?: string,
): Promise<{ learned: LearnedCompositeParams; improved: boolean; baselineScore: number; learnedScore: number }> {
  const baseKey = segmentKey.replace(/_inseason|_offseason|_postDraft|_postSeason/, '')
  const defaults = getDefaultCompositeParams(baseKey)

  const backtestResults = await prisma.rankingsBacktestResult.findMany({
    where: { segmentKey: { startsWith: baseKey } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  if (backtestResults.length < MIN_BACKTEST_RESULTS) {
    return { learned: defaults, improved: false, baselineScore: 0, learnedScore: 0 }
  }

  const baselineScore = computeAggregateScore(backtestResults)

  const currentApplied = await getActiveCompositeParams(segmentKey)

  const candidates: ParamCandidate[] = [{ params: currentApplied, score: baselineScore }]

  const paramKeys: (keyof LearnedCompositeParams)[] = [
    'injuryInfluence',
    'starterBenchSplit',
    'luckDampening',
    'futureCapitalInfluence',
  ]

  const useRecompute = !!backtestLeagueId
  const recomputeWeeks = backtestResults
    .filter((r: any) => r.leagueId === backtestLeagueId)
    .map((r: any) => ({ week: r.weekEvaluated as number, season: String(r.season || '2025'), target: r.targetType as 'win_pct_3w' | 'playoff_qual' | 'championship_finish' }))
    .slice(0, 6)

  for (const key of paramKeys) {
    const [lo, hi] = PARAM_BOUNDS[key]
    const current = currentApplied[key]
    const step = (hi - lo) / 8

    for (let delta = -2; delta <= 2; delta++) {
      if (delta === 0) continue
      const candidate = { ...currentApplied }
      candidate[key] = clamp(current + delta * step, lo, hi)

      if (useRecompute && recomputeWeeks.length >= 3) {
        const recomputedScore = await evaluateCandidateViaBacktest(
          backtestLeagueId!,
          recomputeWeeks,
          segmentKey,
          candidate,
        )
        candidates.push({ params: candidate, score: recomputedScore ?? projectBacktestScore(backtestResults, candidate, currentApplied) })
      } else {
        const projectedScore = projectBacktestScore(backtestResults, candidate, currentApplied)
        candidates.push({ params: candidate, score: projectedScore })
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  const clamped = clampParamMovement(best.params, currentApplied, MAX_WEEKLY_PARAM_MOVEMENT)

  const improved = best.score > baselineScore * 1.005

  return {
    learned: clamped,
    improved,
    baselineScore: Math.round(baselineScore * 10000) / 10000,
    learnedScore: Math.round(best.score * 10000) / 10000,
  }
}

async function evaluateCandidateViaBacktest(
  leagueId: string,
  weeks: Array<{ week: number; season: string; target: 'win_pct_3w' | 'playoff_qual' | 'championship_finish' }>,
  segmentKey: string,
  candidateParams: LearnedCompositeParams,
): Promise<number | null> {
  const results: Array<{ brier: number; ece: number; ndcg: number; spearman: number }> = []

  for (const w of weeks) {
    try {
      const result = await runBacktestForWeek(
        leagueId,
        w.season,
        w.week,
        segmentKey,
        w.target,
        3,
        candidateParams,
      )
      if (result) {
        results.push(result.metrics)
      }
    } catch {
      continue
    }
  }

  if (results.length < 2) return null
  return computeAggregateScore(results)
}

function computeAggregateScore(
  results: Array<{ brier: number; ece: number; ndcg: number; spearman: number }>,
): number {
  if (results.length === 0) return 0

  let totalBrier = 0
  let totalNdcg = 0
  let totalSpearman = 0
  for (const r of results) {
    totalBrier += r.brier
    totalNdcg += r.ndcg
    totalSpearman += r.spearman
  }

  const avgBrier = totalBrier / results.length
  const avgNdcg = totalNdcg / results.length
  const avgSpearman = totalSpearman / results.length

  return 0.4 * (1 - avgBrier) + 0.35 * avgNdcg + 0.25 * ((avgSpearman + 1) / 2)
}

function projectBacktestScore(
  results: Array<{ brier: number; ece: number; ndcg: number; spearman: number }>,
  candidate: LearnedCompositeParams,
  baseline: LearnedCompositeParams,
): number {
  const baseScore = computeAggregateScore(results)

  let adjustment = 0

  const injuryDelta = candidate.injuryInfluence - baseline.injuryInfluence
  adjustment += injuryDelta * 0.05

  const splitDelta = candidate.starterBenchSplit - baseline.starterBenchSplit
  adjustment += splitDelta * 0.03

  const luckDelta = candidate.luckDampening - baseline.luckDampening
  adjustment -= Math.abs(luckDelta) * 0.01

  const fcDelta = candidate.futureCapitalInfluence - baseline.futureCapitalInfluence
  adjustment += fcDelta * 0.02

  return baseScore + adjustment
}

function clampParamMovement(
  newP: LearnedCompositeParams,
  prevP: LearnedCompositeParams,
  maxDelta: number,
): LearnedCompositeParams {
  return {
    injuryInfluence: clamp(
      newP.injuryInfluence,
      Math.max(PARAM_BOUNDS.injuryInfluence[0], prevP.injuryInfluence - maxDelta),
      Math.min(PARAM_BOUNDS.injuryInfluence[1], prevP.injuryInfluence + maxDelta),
    ),
    starterBenchSplit: clamp(
      newP.starterBenchSplit,
      Math.max(PARAM_BOUNDS.starterBenchSplit[0], prevP.starterBenchSplit - maxDelta),
      Math.min(PARAM_BOUNDS.starterBenchSplit[1], prevP.starterBenchSplit + maxDelta),
    ),
    luckDampening: clamp(
      newP.luckDampening,
      Math.max(PARAM_BOUNDS.luckDampening[0], prevP.luckDampening - maxDelta * 10),
      Math.min(PARAM_BOUNDS.luckDampening[1], prevP.luckDampening + maxDelta * 10),
    ),
    futureCapitalInfluence: clamp(
      newP.futureCapitalInfluence,
      Math.max(PARAM_BOUNDS.futureCapitalInfluence[0], prevP.futureCapitalInfluence - maxDelta),
      Math.min(PARAM_BOUNDS.futureCapitalInfluence[1], prevP.futureCapitalInfluence + maxDelta),
    ),
  }
}

export async function persistLearnedCompositeParams(
  segmentKey: string,
  params: LearnedCompositeParams,
): Promise<void> {
  const baseKey = segmentKey.replace(/_inseason|_offseason|_postDraft|_postSeason/, '')

  const latest = await prisma.rankingWeightsWeekly.findFirst({
    where: {
      segmentKey: { startsWith: baseKey },
      status: 'APPLIED',
    },
    orderBy: { weekStart: 'desc' },
  })

  if (latest) {
    await prisma.rankingWeightsWeekly.update({
      where: { id: latest.id },
      data: {
        compositeParamsJson: params as any,
      },
    })
  }
}
