import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const GET = withApiUsage({ endpoint: "/api/legacy/waiver/leagues", tool: "LegacyWaiverLeagues" })(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const sleeperUsername = searchParams.get('sleeper_username')

  if (!sleeperUsername) {
    return NextResponse.json({ error: 'Missing sleeper_username' }, { status: 400 })
  }

  try {
    const user = await prisma.legacyUser.findUnique({
      where: { sleeperUsername: sleeperUsername.toLowerCase() },
      include: {
        leagues: {
          where: {
            season: { gte: 2024 },
          },
          orderBy: { season: 'desc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const leagues = user.leagues.map(l => ({
      league_id: l.sleeperLeagueId,
      name: l.name,
      season: l.season,
      sport: l.sport || 'nfl',
      scoring: l.scoringType,
      team_count: l.teamCount,
      league_type: l.leagueType,
      is_sf: l.isSF,
      is_tep: l.isTEP,
    }))

    return NextResponse.json({
      ok: true,
      leagues,
      count: leagues.length,
    })
  } catch (error: any) {
    console.error('Get leagues error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
})
