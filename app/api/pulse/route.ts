import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const leagueId = req.nextUrl.searchParams.get('leagueId')
  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId required' }, { status: 400 })
  }

  const league = await prisma.league.findFirst({
    where: { id: leagueId, userId: (session.user as any).id },
    include: {
      teams: { orderBy: { pointsFor: 'desc' } },
      trades: { orderBy: { createdAt: 'desc' }, take: 10 },
      rosters: true,
    },
  })

  if (!league) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 })
  }

  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [tradesThisWeek, tradesLastWeek] = await Promise.all([
    prisma.trade.count({
      where: { leagueId, createdAt: { gte: oneWeekAgo } },
    }),
    prisma.trade.count({
      where: { leagueId, createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
    }),
  ])

  const recentTrades = league.trades.map(t => ({
    id: t.id,
    team1Id: t.team1Id,
    team2Id: t.team2Id,
    team1Assets: t.team1Assets,
    team2Assets: t.team2Assets,
    executedAt: t.executedAt || t.createdAt,
    status: t.status,
  }))

  const standings = league.teams.map((team, idx) => ({
    rank: idx + 1,
    id: team.id,
    externalId: team.externalId,
    teamName: team.teamName,
    ownerName: team.ownerName,
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
    pointsFor: team.pointsFor,
    pointsAgainst: team.pointsAgainst,
    avatarUrl: team.avatarUrl,
  }))

  const totalPoints = standings.reduce((sum, t) => sum + t.pointsFor, 0)
  const avgPoints = standings.length ? totalPoints / standings.length : 0

  const alerts: Array<{ type: string; message: string; severity: string }> = []

  if (tradesThisWeek >= 3) {
    alerts.push({
      type: 'trade_surge',
      message: `${tradesThisWeek} trades completed this week — league is very active!`,
      severity: 'info',
    })
  }

  const topTeam = standings[0]
  if (topTeam && topTeam.wins >= 5) {
    alerts.push({
      type: 'dominant_team',
      message: `${topTeam.teamName} leads with a ${topTeam.wins}-${topTeam.losses} record`,
      severity: 'warning',
    })
  }

  return NextResponse.json({
    leagueId: league.id,
    leagueName: league.name,
    leagueSize: league.leagueSize,
    scoring: league.scoring,
    isDynasty: league.isDynasty,
    tradesThisWeek,
    tradesLastWeek,
    waiverAdds: 0,
    rosterMoves: league.rosters.length,
    recentTrades,
    standings,
    avgPointsPerTeam: Math.round(avgPoints * 10) / 10,
    alerts,
    lastSyncedAt: league.lastSyncedAt,
  })
}
