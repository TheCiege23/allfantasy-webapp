import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeBoardDrift } from '@/lib/mock-draft/board-drift'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leagueId, userSlot } = await req.json()

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
      select: { id: true, leagueSize: true, isDynasty: true, teams: { select: { id: true } } },
    })

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const teamCount = league.leagueSize || league.teams.length || 12
    const slot = typeof userSlot === 'number' ? userSlot : 1
    const isDynasty = league.isDynasty ?? false

    const report = await computeBoardDrift(
      leagueId,
      session.user.id,
      slot,
      teamCount,
      isDynasty
    )

    return NextResponse.json(report)
  } catch (err: any) {
    console.error('[board-drift] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate board drift report' }, { status: 500 })
  }
}
