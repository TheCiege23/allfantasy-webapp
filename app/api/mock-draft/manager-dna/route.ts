import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLiveADP } from '@/lib/adp-data'
import { applyRealtimeAdpAdjustments } from '@/lib/mock-draft/adp-realtime-adjuster'
import { buildManagerDNAFromLeague } from '@/lib/mock-draft/manager-dna'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const leagueId = String(body?.leagueId || '')
    if (!leagueId) return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
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

    return NextResponse.json({
      ok: true,
      league: { id: league.id, name: league.name, size: league.leagueSize || league.teams.length },
      dnaCards,
    })
  } catch (err: any) {
    console.error('[mock-draft/manager-dna] error', err)
    return NextResponse.json({ error: err?.message || 'Failed to generate manager DNA' }, { status: 500 })
  }
}
