import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeDraftProjectionScore } from '@/lib/devy-model'
import { computeClassDepthByPosition } from '@/lib/pick-valuation'

function riskBand(player: any): 'LOW' | 'MEDIUM' | 'HIGH' {
  const risk =
    (player.injurySeverityScore ?? 0) * 0.4 +
    (player.transferStatus ? 10 : 0) +
    (player.redshirtStatus ? 5 : 0)

  if (risk < 20) return 'LOW'
  if (risk < 50) return 'MEDIUM'
  return 'HIGH'
}

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
    riskBand: riskBand(p),
  }))

  enriched.sort((a: any, b: any) => b.draftProjectionScore - a.draftProjectionScore)

  const currentYear = new Date().getFullYear()
  const classYears = [currentYear + 1, currentYear + 2, currentYear + 3]
  const classDepth = classYears.map(year => {
    const yearPlayers = enriched.filter((p: any) => {
      const eligYear = p.draftEligibleYear ?? p.classYear
      return eligYear === year || (!eligYear && year === currentYear + 1)
    })
    const depth = computeClassDepthByPosition(yearPlayers)
    return { year, ...depth }
  })

  return NextResponse.json({
    success: true,
    players: enriched,
    classDepth,
  })
}
