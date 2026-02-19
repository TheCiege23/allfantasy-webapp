import { NextResponse } from 'next/server'
import { runTradeAnalysis } from '@/lib/engine'
import type { TradeEngineRequest } from '@/lib/engine'
import { assembleTradeDecisionContext } from '@/lib/trade-engine/trade-context-assembler'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TradeEngineRequest

    const leagueId = body.leagueId || body.league_id || body.leagueContext?.leagueId || ''
    if (!leagueId) {
      return NextResponse.json({ error: 'Missing league_id/leagueId' }, { status: 400 })
    }
    if (!body.assetsA || !body.assetsB) {
      return NextResponse.json({ error: 'Missing assetsA/assetsB' }, { status: 400 })
    }

    const [result, canonicalContext] = await Promise.all([
      runTradeAnalysis(body),
      assembleTradeDecisionContext(
        { name: body.teamAName || 'Team A', assets: body.assetsA },
        { name: body.teamBName || 'Team B', assets: body.assetsB },
        {
          leagueId,
          platform: body.leagueContext?.platform || undefined,
          scoringType: body.leagueContext?.scoringType || undefined,
          numTeams: body.leagueContext?.numTeams || undefined,
          isSF: body.leagueContext?.isSF || undefined,
          isTEP: body.leagueContext?.isTEP || undefined,
          scoringSettings: body.leagueContext?.scoringSettings || {},
        },
      ).catch(e => {
        console.warn('[engine/trade] Canonical context assembly failed:', e?.message)
        return null
      }),
    ])

    return NextResponse.json({
      ok: true,
      analysis: result,
      ...(canonicalContext ? {
        contextId: canonicalContext.contextId,
        dataFreshness: {
          staleSourceCount: [
            canonicalContext.missingData.valuationDataStale,
            canonicalContext.missingData.adpDataStale,
            canonicalContext.missingData.injuryDataStale,
            canonicalContext.missingData.analyticsDataStale,
            canonicalContext.missingData.tradeHistoryStale,
          ].filter(Boolean).length,
          staleSources: [
            ...(canonicalContext.missingData.valuationDataStale ? ['Valuations'] : []),
            ...(canonicalContext.missingData.adpDataStale ? ['ADP'] : []),
            ...(canonicalContext.missingData.injuryDataStale ? ['Injuries'] : []),
            ...(canonicalContext.missingData.analyticsDataStale ? ['Analytics'] : []),
            ...(canonicalContext.missingData.tradeHistoryStale ? ['Trade History'] : []),
          ],
        },
      } : {}),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Engine trade analysis failed' },
      { status: 500 }
    )
  }
}
