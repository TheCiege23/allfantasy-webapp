import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import {
  getGoalWeights,
  getBaselineWeights,
  smoothWeights,
  applyGoalModifier,
  getWeightEvolution,
  blendMultiYearWeights,
  resolveLeagueClass,
} from '@/lib/rankings-engine/adaptive-weight-learning'
import { getActiveWeightsForSegment } from '@/lib/rankings-engine/weekly-weight-learning'

export const GET = withApiUsage({ endpoint: "/api/rankings/adaptive", tool: "RankingsAdaptive" })(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const leagueType = sp.get('leagueType') ?? 'redraft'
  const isSF = sp.get('isSF') === 'true'
  const specialty = sp.get('specialty') ?? null
  const goal = sp.get('goal') ?? 'balanced'
  const season = sp.get('season') ? Number(sp.get('season')) : new Date().getFullYear()

  const leagueClass = resolveLeagueClass({
    leagueType,
    specialtyFormat: specialty,
    isSF,
  })

  const baseline = getBaselineWeights(leagueClass)

  const weeklyWeights = await getActiveWeightsForSegment(leagueClass)

  const isWeeklyActive =
    weeklyWeights.market !== baseline.market ||
    weeklyWeights.impact !== baseline.impact ||
    weeklyWeights.scarcity !== baseline.scarcity ||
    weeklyWeights.demand !== baseline.demand

  let dataSmoothed = weeklyWeights

  if (!isWeeklyActive) {
    const evolution = await getWeightEvolution(leagueClass)
    const multiYearLearned = evolution.length > 0
      ? blendMultiYearWeights(evolution, 3)
      : baseline
    dataSmoothed = smoothWeights(baseline, multiYearLearned)
  }

  const goalWeights = getGoalWeights(goal)
  const finalWeights = applyGoalModifier(dataSmoothed, goalWeights)

  return NextResponse.json({
    leagueClass,
    season,
    goal,
    baseline,
    dataSmoothed,
    goalWeights,
    finalWeights,
    source: isWeeklyActive ? 'weekly_learning' : 'multi_year_blend',
  })
})
