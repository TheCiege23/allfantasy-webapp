import { NextResponse } from 'next/server'
import { runTradeAnalysis } from '@/lib/engine'
import type { TradeEngineRequest } from '@/lib/engine'

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

    const result = await runTradeAnalysis(body)

    return NextResponse.json({ ok: true, analysis: result })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Engine trade analysis failed' },
      { status: 500 }
    )
  }
}
