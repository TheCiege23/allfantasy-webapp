import { NextResponse } from 'next/server'
import { runTradeAnalysis } from '@/lib/engine'
import type { TradeEngineRequest } from '@/lib/engine'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const originalRequest = body.originalRequest as TradeEngineRequest | undefined
    const appliedCounter = body.appliedCounter as {
      addToGive?: { id: string; name: string; pos?: string; team?: string }
      addToGet?: { id: string; name: string; pos?: string; team?: string }
    } | undefined

    if (!originalRequest) {
      return NextResponse.json({ error: 'Missing originalRequest' }, { status: 400 })
    }

    const leagueId = originalRequest.leagueId || originalRequest.league_id || originalRequest.leagueContext?.leagueId || ''
    if (!leagueId) {
      return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 })
    }

    const modifiedRequest = { ...originalRequest }
    modifiedRequest.assetsA = [...(originalRequest.assetsA || [])]
    modifiedRequest.assetsB = [...(originalRequest.assetsB || [])]

    if (appliedCounter?.addToGive) {
      const p = appliedCounter.addToGive
      modifiedRequest.assetsB = [
        ...modifiedRequest.assetsB,
        {
          type: 'player' as const,
          player: {
            id: p.id,
            name: p.name,
            pos: p.pos,
            team: p.team,
            league: 'NFL' as const,
          },
        },
      ]
    }

    if (appliedCounter?.addToGet) {
      const p = appliedCounter.addToGet
      modifiedRequest.assetsA = [
        ...modifiedRequest.assetsA,
        {
          type: 'player' as const,
          player: {
            id: p.id,
            name: p.name,
            pos: p.pos,
            team: p.team,
            league: 'NFL' as const,
          },
        },
      ]
    }

    const result = await runTradeAnalysis(modifiedRequest)

    const previous = {
      fairnessScore: body.previousFairness ?? null,
      acceptProb: body.previousAcceptProb ?? null,
      starterImpactNet: body.previousStarterNet ?? null,
      championshipOdds: body.previousChampOdds ?? null,
    }

    const deltas = {
      fairness: previous.fairnessScore != null ? result.fairness.score - previous.fairnessScore : null,
      acceptance: previous.acceptProb != null ? result.acceptanceProbability.final - previous.acceptProb : null,
      starterImpact: previous.starterImpactNet != null
        ? (result.meta?.starterImpact?.teamA?.net ?? 0) - previous.starterImpactNet
        : null,
      championshipOdds: previous.championshipOdds != null && result.championshipEquity
        ? result.championshipEquity.teamA.oddsAfter - previous.championshipOdds
        : null,
    }

    return NextResponse.json({
      ok: true,
      analysis: result,
      deltas,
      simulation: {
        counterApplied: !!appliedCounter,
        addedToGive: appliedCounter?.addToGive?.name ?? null,
        addedToGet: appliedCounter?.addToGet?.name ?? null,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Counter simulation failed' },
      { status: 500 }
    )
  }
}
