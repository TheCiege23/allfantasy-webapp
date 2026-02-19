import { NextResponse } from 'next/server'
import { runTradeAnalysis } from '@/lib/engine'
import type { TradeEngineRequest } from '@/lib/engine'
import { buildLeagueDecisionContext, deriveTradeDecisionContext } from '@/lib/trade-engine/league-context-assembler'
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

    const teamAName = body.teamAName || 'Team A'
    const teamBName = body.teamBName || 'Team B'
    const rosterIdA = (body as any).rosterIdA as number | undefined
    const rosterIdB = (body as any).rosterIdB as number | undefined

    const [result, canonicalContext] = await Promise.all([
      runTradeAnalysis(body),
      (async () => {
        try {
          const leagueCtx = await buildLeagueDecisionContext({
            leagueId,
            username: body.leagueContext?.username || teamAName,
            platform: body.leagueContext?.platform || undefined,
          })

          let teamA = rosterIdA != null
            ? leagueCtx.teams.find(t => t.teamId === String(rosterIdA))
            : undefined
          let teamB = rosterIdB != null
            ? leagueCtx.teams.find(t => t.teamId === String(rosterIdB))
            : undefined

          if (!teamA || !teamB) {
            const assetIdsA = new Set(body.assetsA.map((a: any) => String(a.playerId || a.id || a.name).toLowerCase()))
            const assetIdsB = new Set(body.assetsB.map((a: any) => String(a.playerId || a.id || a.name).toLowerCase()))

            for (const team of leagueCtx.teams) {
              const rosterPlayerIds = new Set(team.roster.map(p => String(p.playerId).toLowerCase()))
              const rosterPlayerNames = new Set(team.roster.map(p => (p.name || '').toLowerCase()))

              const matchesA = [...assetIdsA].filter(id => rosterPlayerIds.has(id) || rosterPlayerNames.has(id)).length
              const matchesB = [...assetIdsB].filter(id => rosterPlayerIds.has(id) || rosterPlayerNames.has(id)).length

              if (!teamA && matchesA > 0 && matchesA >= matchesB) teamA = team
              if (!teamB && matchesB > 0 && matchesB > matchesA) teamB = team
            }
          }

          if (!teamA || !teamB) {
            teamA = teamA || leagueCtx.teams.find(t =>
              t.teamName.toLowerCase().includes(teamAName.toLowerCase())
            )
            teamB = teamB || leagueCtx.teams.find(t =>
              t.teamName.toLowerCase().includes(teamBName.toLowerCase())
            )
          }

          if (teamA && teamB) {
            return {
              ctx: deriveTradeDecisionContext(
                leagueCtx,
                teamA.teamId,
                teamB.teamId,
                body.assetsA,
                body.assetsB
              ),
              leagueContextId: leagueCtx.contextId,
            }
          }

          console.warn('[engine/trade] Could not match teams in league context, falling back')
        } catch (e: any) {
          console.warn('[engine/trade] League context assembly failed, falling back:', e?.message)
        }

        const fallbackCtx = await assembleTradeDecisionContext(
          { name: teamAName, assets: body.assetsA },
          { name: teamBName, assets: body.assetsB },
          {
            leagueId,
            platform: body.leagueContext?.platform || undefined,
            scoringType: body.leagueContext?.scoringType || undefined,
            numTeams: body.leagueContext?.numTeams || undefined,
            isSF: body.leagueContext?.isSF || undefined,
            isTEP: body.leagueContext?.isTEP || undefined,
            scoringSettings: body.leagueContext?.scoringSettings || {},
          },
        )
        return { ctx: fallbackCtx, leagueContextId: null }
      })().catch(e => {
        console.warn('[engine/trade] All context assembly failed:', e?.message)
        return null
      }),
    ])

    return NextResponse.json({
      ok: true,
      analysis: result,
      ...(canonicalContext ? {
        contextId: canonicalContext.ctx.contextId,
        ...(canonicalContext.leagueContextId ? { leagueContextId: canonicalContext.leagueContextId } : {}),
        sourceFreshness: canonicalContext.ctx.sourceFreshness || null,
        dataFreshness: {
          staleSourceCount: [
            canonicalContext.ctx.missingData.valuationDataStale,
            canonicalContext.ctx.missingData.adpDataStale,
            canonicalContext.ctx.missingData.injuryDataStale,
            canonicalContext.ctx.missingData.analyticsDataStale,
            canonicalContext.ctx.missingData.tradeHistoryStale,
          ].filter(Boolean).length,
          staleSources: [
            ...(canonicalContext.ctx.missingData.valuationDataStale ? ['Valuations'] : []),
            ...(canonicalContext.ctx.missingData.adpDataStale ? ['ADP'] : []),
            ...(canonicalContext.ctx.missingData.injuryDataStale ? ['Injuries'] : []),
            ...(canonicalContext.ctx.missingData.analyticsDataStale ? ['Analytics'] : []),
            ...(canonicalContext.ctx.missingData.tradeHistoryStale ? ['Trade History'] : []),
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
