import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"
import { runBacktestSweep } from '@/lib/rankings-engine/backtest'
import { learnCompositeParamsFromBacktest, persistLearnedCompositeParams } from '@/lib/rankings-engine/composite-param-learning'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const LEAGUE_CLASS_SEGMENTS = ['DYN_SF', 'DYN_1QB', 'RED_SF', 'RED_1QB'] as const

export const POST = withApiUsage({ endpoint: "/api/admin/weekly-backtest", tool: "AdminWeeklyBacktest" })(async (req: NextRequest) => {
  if (!isAuthorizedRequest(req)) return adminUnauthorized()

  try {
    const body = await req.json().catch(() => ({}))
    const season = String(body.season || '2025')
    const leagueId = body.leagueId as string | undefined
    const maxWeek = body.maxWeek ?? 14
    const dryRun = body.dryRun === true

    const backtestResults: Array<{ segment: string; resultCount: number }> = []
    const paramResults: Array<{
      segment: string
      improved: boolean
      baselineScore: number
      learnedScore: number
      dryRun: boolean
    }> = []

    if (leagueId) {
      const segment = body.segment || 'DYN_SF'
      const results = await runBacktestSweep(leagueId, season, segment, maxWeek)
      backtestResults.push({ segment, resultCount: results.length })

      const paramResult = await learnCompositeParamsFromBacktest(`${segment}_inseason`, leagueId)
      if (paramResult.improved && !dryRun) {
        await persistLearnedCompositeParams(`${segment}_inseason`, paramResult.learned)
      }
      paramResults.push({
        segment,
        improved: paramResult.improved,
        baselineScore: paramResult.baselineScore,
        learnedScore: paramResult.learnedScore,
        dryRun,
      })
    } else {
      for (const segment of LEAGUE_CLASS_SEGMENTS) {
        try {
          const paramResult = await learnCompositeParamsFromBacktest(`${segment}_inseason`)
          if (paramResult.improved && !dryRun) {
            await persistLearnedCompositeParams(`${segment}_inseason`, paramResult.learned)
          }
          paramResults.push({
            segment,
            improved: paramResult.improved,
            baselineScore: paramResult.baselineScore,
            learnedScore: paramResult.learnedScore,
            dryRun,
          })
        } catch (err: any) {
          console.error(`[WeeklyBacktest] ${segment} failed:`, err?.message)
          paramResults.push({ segment, improved: false, baselineScore: 0, learnedScore: 0, dryRun })
        }
      }
    }

    return NextResponse.json({
      success: true,
      backtestResults,
      paramLearning: paramResults,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
    })
  } catch (err: any) {
    console.error('[admin/weekly-backtest] Error:', err)
    return NextResponse.json({ error: err?.message || 'Backtest failed' }, { status: 500 })
  }
})
