import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const leagueId = req.nextUrl.searchParams.get('leagueId')

  const where: any = { userId }
  if (leagueId) {
    where.leagueId = leagueId
  }

  try {
    const reports = await prisma.aIStrategyReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        archetype: true,
        score: true,
        leagueId: true,
        createdAt: true,
        content: true,
      },
    })

    return NextResponse.json({ reports })
  } catch (error: any) {
    console.error('[Strategy Reports] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}
