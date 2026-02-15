import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { computeLeagueDemandIndex, computePerManagerLDI } from '@/lib/rankings-engine/league-demand-index'
import {
  persistLeagueDemand,
  getDemandTrends,
  getLatestDemandSnapshot,
} from '@/lib/rankings-engine/ldi-persistence'

export const GET = withApiUsage({ endpoint: "/api/leagues/demand-index", tool: "LeaguesDemandIndex" })(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const leagueId = sp.get('leagueId')
  const range = Number(sp.get('range') ?? 90)
  const mode = sp.get('mode') ?? 'live'
  const includeManagers = sp.get('includeManagers') === 'true'

  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId required' }, { status: 400 })
  }

  try {
    let basePayload: any

    if (mode === 'cached') {
      const snapshot = await getLatestDemandSnapshot(leagueId, range)
      if (snapshot) {
        const trends = await getDemandTrends(leagueId, range)
        basePayload = { ...snapshot, trends }
      }
    }

    if (!basePayload && mode === 'persist') {
      const ldi = await persistLeagueDemand(leagueId, range)
      const trends = await getDemandTrends(leagueId, range)
      basePayload = { ...ldi, trends }
    }

    if (!basePayload) {
      const ldi = await computeLeagueDemandIndex(leagueId, range)
      basePayload = ldi
    }

    if (includeManagers) {
      const perManager = await computePerManagerLDI(leagueId, range)
      basePayload.perManager = perManager
    }

    return NextResponse.json(basePayload)
  } catch (err: any) {
    console.error('[Demand Index API]', err?.message)
    return NextResponse.json({ error: 'Failed to compute demand index' }, { status: 500 })
  }
})
