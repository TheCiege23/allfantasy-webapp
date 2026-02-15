import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { computeLeagueDemandIndex, computePerManagerLDI } from '@/lib/rankings-engine/league-demand-index'
import {
  persistLeagueDemand,
  getDemandTrends,
  getLatestDemandSnapshot,
} from '@/lib/rankings-engine/ldi-persistence'
import { hardenLdiResponse } from "@/lib/ldi/harden-ldi"
import { hardenPartnerTendenciesResponse } from "@/lib/partner/harden-partner-tendencies"

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

    const now = new Date()
    const month = now.getMonth()
    const isOffseason = month >= 2 && month <= 8

    if (includeManagers && basePayload.perManager) {
      const hardenedPartners = hardenPartnerTendenciesResponse({
        raw: { partnerTendencies: basePayload.perManager, tradesAnalyzed: basePayload.tradesAnalyzed },
        leagueId,
        leagueName: basePayload?.leagueName,
        season: basePayload?.season,
        week: basePayload?.week ?? null,
        isOffseason,
      })
      basePayload.partnerMeta = {
        fallbackMode: hardenedPartners.fallbackMode,
        rankingSource: hardenedPartners.rankingSource,
        rankingSourceNote: hardenedPartners.rankingSourceNote,
        partnersAnalyzed: hardenedPartners.partnersAnalyzed,
        partnerPosCounts: hardenedPartners.partnerPosCounts,
        warnings: hardenedPartners.warnings,
      }
    }

    const hardened = hardenLdiResponse({
      raw: basePayload,
      leagueId,
      leagueName: basePayload?.leagueName,
      season: basePayload?.season,
      week: basePayload?.week ?? null,
      isOffseason,
    })

    return NextResponse.json({
      ...hardened,
      ...basePayload,
      fallbackMode: hardened.fallbackMode,
      ldiByPos: hardened.ldiByPos,
      positionDemandNorm: hardened.positionDemandNorm,
      pickDemand: basePayload?.pickDemand ?? hardened.pickDemand,
      rankingSource: hardened.rankingSource,
      rankingSourceNote: hardened.rankingSourceNote,
      warnings: hardened.warnings,
      isOffseason: hardened.isOffseason,
      tradesAnalyzed: hardened.tradesAnalyzed,
      sampleSize: hardened.sampleSize,
      partnerCount: hardened.partnerCount,
    })
  } catch (err: any) {
    console.error('[Demand Index API]', err?.message)
    return NextResponse.json({ error: 'Failed to compute demand index' }, { status: 500 })
  }
})
