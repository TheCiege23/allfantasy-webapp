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

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')

  if (!leagueId) {
    return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 })
  }

  try {
    const reports = await prisma.aIStrategyReport.findMany({
      where: {
        userId,
        leagueId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        createdAt: true,
        archetype: true,
        score: true,
        content: true,
      },
    })

    return NextResponse.json({ success: true, reports })
  } catch (error) {
    console.error('Fetch reports error:', error)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}
