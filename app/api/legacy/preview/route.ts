import { NextRequest, NextResponse } from 'next/server'
import { getLeagueHistoryChain, getLeagueUsers, getLeagueRosters, getLeagueInfo } from '@/lib/sleeper-client'

export async function GET(req: NextRequest) {
  const sleeperLeagueId = req.nextUrl.searchParams.get('sleeperLeagueId')

  if (!sleeperLeagueId) {
    return NextResponse.json({ error: 'sleeperLeagueId is required' }, { status: 400 })
  }

  try {
    const [league, users, rosters, history] = await Promise.all([
      getLeagueInfo(sleeperLeagueId),
      getLeagueUsers(sleeperLeagueId),
      getLeagueRosters(sleeperLeagueId),
      getLeagueHistoryChain(sleeperLeagueId, 4),
    ])

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const managersCount = users?.length || rosters?.length || league.total_rosters || 0

    return NextResponse.json({
      leagueId: league.league_id,
      name: league.name,
      season: league.season,
      managersCount,
      history,
    })
  } catch (error: any) {
    console.error('Preview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch preview' },
      { status: 500 }
    )
  }
}
