import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { syncIdentityMap } from '@/lib/unified-player-service'
import { syncAPISportsPlayersToIdentityMap } from '@/lib/api-sports'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export const POST = withApiUsage({ endpoint: "/api/legacy/identity-sync", tool: "LegacyIdentitySync" })(async (request: NextRequest) => {
  try {
    const authHeader = request.headers.get('x-admin-key')
    const adminPassword = process.env.ADMIN_PASSWORD

    if (adminPassword && authHeader !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[IdentitySync] Starting identity map sync...')
    const result = await syncIdentityMap()
    console.log(`[IdentitySync] FantasyCalc/RI: ${result.created} created, ${result.updated} updated, ${result.matched} RI matched`)

    let apiSportsResult = { linked: 0, created: 0 }
    try {
      apiSportsResult = await syncAPISportsPlayersToIdentityMap()
      console.log(`[IdentitySync] API-Sports: ${apiSportsResult.linked} linked, ${apiSportsResult.created} created`)
    } catch (err) {
      console.warn('[IdentitySync] API-Sports sync skipped:', err)
    }

    return NextResponse.json({
      success: true,
      fantasyCalc: { created: result.created, updated: result.updated },
      rollingInsights: { matched: result.matched },
      apiSports: apiSportsResult,
    })
  } catch (error) {
    console.error('[IdentitySync] Error:', error)
    return NextResponse.json(
      { error: 'Identity sync failed', details: String(error) },
      { status: 500 }
    )
  }
})

export const GET = withApiUsage({ endpoint: "/api/legacy/identity-sync", tool: "LegacyIdentitySync" })(async () => {
  const { prisma } = await import('@/lib/prisma')

  const [
    totalPlayers,
    withSleeperId,
    withFantasyCalcId,
    withRollingInsightsId,
    withApiSportsId,
    fullyLinked,
  ] = await Promise.all([
    prisma.playerIdentityMap.count(),
    prisma.playerIdentityMap.count({ where: { sleeperId: { not: null } } }),
    prisma.playerIdentityMap.count({ where: { fantasyCalcId: { not: null } } }),
    prisma.playerIdentityMap.count({ where: { rollingInsightsId: { not: null } } }),
    prisma.playerIdentityMap.count({ where: { apiSportsId: { not: null } } }),
    prisma.playerIdentityMap.count({
      where: {
        sleeperId: { not: null },
        fantasyCalcId: { not: null },
        rollingInsightsId: { not: null },
      },
    }),
  ])

  return NextResponse.json({
    totalPlayers,
    withSleeperId,
    withFantasyCalcId,
    withRollingInsightsId,
    withApiSportsId,
    fullyLinked,
    coverage: {
      sleeper: totalPlayers > 0 ? Math.round((withSleeperId / totalPlayers) * 100) : 0,
      fantasyCalc: totalPlayers > 0 ? Math.round((withFantasyCalcId / totalPlayers) * 100) : 0,
      rollingInsights: totalPlayers > 0 ? Math.round((withRollingInsightsId / totalPlayers) * 100) : 0,
      apiSports: totalPlayers > 0 ? Math.round((withApiSportsId / totalPlayers) * 100) : 0,
      fullyLinked: totalPlayers > 0 ? Math.round((fullyLinked / totalPlayers) * 100) : 0,
    },
  })
})
