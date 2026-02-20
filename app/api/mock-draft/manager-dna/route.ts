import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLiveADP } from '@/lib/adp-data'
import { applyRealtimeAdpAdjustments } from '@/lib/mock-draft/adp-realtime-adjuster'
import { buildManagerDNAFromLeague } from '@/lib/mock-draft/manager-dna'
import { sleeperAvatarUrl } from '@/lib/sleeper/players-cache'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const leagueId = String(body?.leagueId || '')
    if (!leagueId) return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })

    const league = await prisma.league.findFirst({
      where: { userId: session.user.id, OR: [{ id: leagueId }, { platformLeagueId: leagueId }] },
      include: {
        teams: {
          include: { performances: { orderBy: { week: 'desc' }, take: 12 } },
          orderBy: { currentRank: 'asc' },
          take: 20,
        },
        rosters: { select: { platformUserId: true, playerData: true }, take: 20 },
      },
    })

    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
    if (!league.teams.length) return NextResponse.json({ error: 'No teams found in this league' }, { status: 400 })

    const adp = await getLiveADP(league.isDynasty ? 'dynasty' : 'redraft', 220)
    const adjusted = await applyRealtimeAdpAdjustments(adp, { isDynasty: league.isDynasty })
    const pool = adjusted.entries.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position)).slice(0, 200)

    const dnaCards = buildManagerDNAFromLeague(
      league.teams.map(t => ({
        teamName: t.teamName,
        ownerName: t.ownerName,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        pointsFor: t.pointsFor,
        currentRank: t.currentRank,
        performances: t.performances.map(p => ({ week: p.week, points: p.points })),
        platformUserId: (t as any).platformUserId || t.externalId,
      })),
      league.rosters,
      pool,
      league.isDynasty,
      league.leagueSize || league.teams.length
    )

    let avatarMap: Record<string, string> = {}
    try {
      if (league.platformLeagueId) {
        const usersRes = await fetch(
          `https://api.sleeper.app/v1/league/${league.platformLeagueId}/users`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (usersRes.ok) {
          const users: Array<{ user_id?: string; avatar?: string; display_name?: string }> = await usersRes.json()
          for (const u of users) {
            if (u.user_id && u.avatar) {
              avatarMap[u.user_id] = sleeperAvatarUrl(u.avatar)
            }
          }
        }
      }
    } catch {}

    const enrichedCards = dnaCards.map((card: any) => {
      const platformUserId = card.platformUserId || null
      const avatarUrl = (platformUserId && avatarMap[platformUserId]) || null
      return { ...card, avatarUrl }
    })

    return NextResponse.json({
      ok: true,
      league: { id: league.id, name: league.name, size: league.leagueSize || league.teams.length },
      dnaCards: enrichedCards,
    })
  } catch (err: any) {
    console.error('[mock-draft/manager-dna] error', err)
    return NextResponse.json({ error: err?.message || 'Failed to generate manager DNA' }, { status: 500 })
  }
}
