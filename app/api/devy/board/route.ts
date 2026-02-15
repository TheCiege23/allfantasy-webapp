import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeDraftProjectionScore } from '@/lib/devy-model'

export async function POST(req: Request) {
  const { leagueId } = await req.json()

  if (!leagueId) {
    return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 })
  }

  const players = await (prisma as any).player.findMany({
    where: {
      league: 'NCAA',
      devyEligible: true,
      graduatedToNFL: false,
      active: true,
    },
  })

  const enriched = players.map((p: any) => ({
    ...p,
    draftProjectionScore: computeDraftProjectionScore(p),
  }))

  enriched.sort((a: any, b: any) => b.draftProjectionScore - a.draftProjectionScore)

  return NextResponse.json({
    success: true,
    players: enriched,
  })
}
