import { NextRequest, NextResponse } from 'next/server'
import { getLeagueHistoryChain, getLeagueUsers, getLeagueInfo } from '@/lib/sleeper-client'

export async function GET(req: NextRequest) {
  const sleeperLeagueId = req.nextUrl.searchParams.get('sleeperLeagueId')

  if (!sleeperLeagueId) {
    return NextResponse.json({ error: 'Missing sleeperLeagueId parameter' }, { status: 400 })
  }

  try {
    const [league, users, historyChain] = await Promise.all([
      getLeagueInfo(sleeperLeagueId),
      getLeagueUsers(sleeperLeagueId),
      getLeagueHistoryChain(sleeperLeagueId, 5),
    ])

    if (!league) {
      return NextResponse.json({ error: 'League not found in Sleeper' }, { status: 404 })
    }

    const managersCount = users?.length || league.total_rosters || 0

    const preview = {
      leagueName: league.name,
      currentSeason: league.season,
      seasonsCount: historyChain.length,
      managersCount,
      tradesCount: 'N/A in preview',
      rostersCount: 'N/A in preview',
      history: historyChain.map((entry) => ({
        season: entry.season,
        champion: entry.champion || 'Unknown',
        emoji: entry.champion ? '\uD83C\uDFC6' : (entry.season === league.season ? '\uD83D\uDD25' : '\uD83D\uDCC5'),
        isCurrent: entry.season === league.season,
      })),
      hasLimitedHistory: historyChain.length <= 2 && !historyChain.some(h => h.champion),
      avatar: league.avatar ? `https://sleepercdn.com/avatars/${league.avatar}` : null,
    }

    return NextResponse.json({ success: true, preview })
  } catch (error: any) {
    console.error('[Preview API] Error:', error)

    let message = 'Failed to load league preview'
    let status = 500

    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      message = 'Sleeper API rate limit reached — try again in 30-60 seconds'
      status = 429
    } else if (error.message?.includes('not found') || error.message?.includes('404')) {
      message = 'League not found or no longer accessible'
      status = 404
    }

    return NextResponse.json({ error: message }, { status })
  }
}
