import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getLeagueInfo,
  getLeagueRosters,
  getLeagueUsers,
  getLeagueTransactions,
  getLeagueMatchups,
  getLeagueType,
  getScoringType,
} from '@/lib/sleeper-client'
import type { SleeperTransaction, SleeperRoster, SleeperUser, SleeperMatchup } from '@/lib/sleeper-client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const leagueId = req.nextUrl.searchParams.get('leagueId')
  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId required' }, { status: 400 })
  }

  const dbLeague = await prisma.league.findFirst({
    where: { id: leagueId, userId: (session.user as any).id },
    include: {
      teams: { orderBy: { pointsFor: 'desc' } },
      trades: { orderBy: { createdAt: 'desc' }, take: 10 },
      rosters: true,
    },
  })

  if (!dbLeague) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 })
  }

  try {
    const sleeperLeagueId = dbLeague.platformLeagueId
    const sleeperLeague = dbLeague.platform === 'sleeper'
      ? await getLeagueInfo(sleeperLeagueId)
      : null

    const currentWeek = sleeperLeague
      ? (sleeperLeague.settings as any)?.leg || (sleeperLeague.settings as any)?.week || 1
      : 1
    const season = sleeperLeague?.season || String(new Date().getFullYear())

    let sleeperRosters: SleeperRoster[] = []
    let sleeperUsers: SleeperUser[] = []
    let thisWeekTx: SleeperTransaction[] = []
    let lastWeekTx: SleeperTransaction[] = []
    let matchups: SleeperMatchup[] = []

    if (sleeperLeague) {
      ;[sleeperRosters, sleeperUsers, thisWeekTx, lastWeekTx, matchups] = await Promise.all([
        getLeagueRosters(sleeperLeagueId),
        getLeagueUsers(sleeperLeagueId),
        getLeagueTransactions(sleeperLeagueId, currentWeek),
        currentWeek > 1 ? getLeagueTransactions(sleeperLeagueId, currentWeek - 1) : Promise.resolve([]),
        getLeagueMatchups(sleeperLeagueId, currentWeek),
      ])
    }

    const tradesThisWeek = thisWeekTx.filter(t => t.type === 'trade').length
    const tradesLastWeek = lastWeekTx.filter(t => t.type === 'trade').length
    const waiversThisWeek = thisWeekTx.filter(t => t.type === 'waiver' || t.type === 'free_agent').length

    const mostActiveManagers = getMostActiveManagers(thisWeekTx, sleeperUsers)
    const activitySpikePercent = calculateActivitySpike(thisWeekTx, lastWeekTx)

    const standings = sleeperRosters.length > 0
      ? sleeperRosters
          .map((r, idx) => {
            const user = sleeperUsers.find(u => u.user_id === r.owner_id)
            return {
              rank: 0,
              rosterId: r.roster_id,
              externalId: r.owner_id,
              teamName: user?.display_name || `Team ${r.roster_id}`,
              ownerName: user?.username || 'Unknown',
              wins: r.settings.wins,
              losses: r.settings.losses,
              ties: r.settings.ties,
              pointsFor: r.settings.fpts + (r.settings.fpts_decimal || 0) / 100,
              pointsAgainst: r.settings.fpts_against + (r.settings.fpts_against_decimal || 0) / 100,
              avatarUrl: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
            }
          })
          .sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins
            return b.pointsFor - a.pointsFor
          })
          .map((t, idx) => ({ ...t, rank: idx + 1 }))
      : dbLeague.teams.map((team, idx) => ({
          rank: idx + 1,
          rosterId: idx + 1,
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

    const hotPlayers = findHotPlayers(matchups)
    const coldPlayers = findColdPlayers(matchups)

    const recentTrades = dbLeague.trades.map(t => ({
      id: t.id,
      team1Id: t.team1Id,
      team2Id: t.team2Id,
      team1Assets: t.team1Assets,
      team2Assets: t.team2Assets,
      executedAt: t.executedAt || t.createdAt,
      status: t.status,
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

    if (activitySpikePercent !== 'Stable') {
      alerts.push({
        type: 'activity_spike',
        message: `Activity is ${activitySpikePercent} compared to last week`,
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

    if (hotPlayers.length > 0) {
      alerts.push({
        type: 'hot_player',
        message: `${hotPlayers[0].rosterId ? `Roster ${hotPlayers[0].rosterId}` : 'A team'} scored ${hotPlayers[0].points.toFixed(1)} pts this week`,
        severity: 'info',
      })
    }

    const userSleeperRoster = sleeperRosters.find(r => {
      const linkedUser = sleeperUsers.find(u => u.display_name && dbLeague.rosters.some(
        dbR => dbR.platformUserId === u.user_id || dbR.platformUserId === r.owner_id
      ))
      return !!linkedUser
    })

    const userMatchup = userSleeperRoster
      ? matchups.find(m => m.roster_id === userSleeperRoster.roster_id)
      : null

    const userTeamPulse = userMatchup ? {
      projectedThisWeek: null,
      actualThisWeek: userMatchup.points,
      starterCount: userMatchup.starters?.length || 0,
    } : null

    return NextResponse.json({
      leagueId: dbLeague.id,
      leagueName: dbLeague.name || sleeperLeague?.name,
      leagueSize: dbLeague.leagueSize || sleeperLeague?.total_rosters,
      scoring: dbLeague.scoring || (sleeperLeague ? getScoringType(sleeperLeague.scoring_settings) : 'Standard'),
      isDynasty: dbLeague.isDynasty || (sleeperLeague ? getLeagueType(sleeperLeague) === 'dynasty' : false),
      week: currentWeek,
      season,
      tradesThisWeek,
      tradesLastWeek,
      waiverAdds: waiversThisWeek,
      rosterMoves: dbLeague.rosters.length,
      mostActiveManagers,
      activitySpikePercent,
      hotPlayers,
      coldPlayers,
      userTeamPulse,
      recentTrades,
      standings,
      avgPointsPerTeam: Math.round(avgPoints * 10) / 10,
      alerts,
      lastSyncedAt: dbLeague.lastSyncedAt,
    })
  } catch (error) {
    console.error('[Pulse API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate pulse data' },
      { status: 500 }
    )
  }
}

function getMostActiveManagers(transactions: SleeperTransaction[], users: SleeperUser[]) {
  const counts = new Map<string, number>()
  transactions.forEach(t => {
    if (t.creator) {
      counts.set(t.creator, (counts.get(t.creator) || 0) + 1)
    }
  })

  return Array.from(counts.entries())
    .map(([id, count]) => ({
      managerId: id,
      name: users.find(u => u.user_id === id)?.display_name || 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

function calculateActivitySpike(thisWeek: SleeperTransaction[], lastWeek: SleeperTransaction[]) {
  const thisCount = thisWeek.length
  const lastCount = lastWeek.length
  if (lastCount === 0 && thisCount > 0) return `+${thisCount} moves (new activity)`
  if (lastCount === 0) return 'Stable'
  const pctChange = Math.round(((thisCount - lastCount) / lastCount) * 100)
  if (pctChange > 100) return `+${pctChange}%`
  if (pctChange > 30) return `+${pctChange}%`
  if (pctChange < -30) return `${pctChange}%`
  return 'Stable'
}

function findHotPlayers(matchups: SleeperMatchup[]) {
  return matchups
    .filter(m => m.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map(m => ({
      rosterId: m.roster_id,
      points: m.points,
      matchupId: m.matchup_id,
    }))
}

function findColdPlayers(matchups: SleeperMatchup[]) {
  return matchups
    .filter(m => m.points >= 0)
    .sort((a, b) => a.points - b.points)
    .slice(0, 5)
    .map(m => ({
      rosterId: m.roster_id,
      points: m.points,
      matchupId: m.matchup_id,
    }))
}
