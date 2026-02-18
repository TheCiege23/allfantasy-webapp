import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.tradeProfile.findUnique({
      where: { userId },
      select: {
        summary: true,
        voteCount: true,
        lastSummarizedAt: true,
        version: true,
      },
    })

    if (!profile) {
      return NextResponse.json({
        summary: 'Not enough feedback yet to build your trade profile.',
        voteCount: 0,
      })
    }

    return NextResponse.json({
      summary: profile.summary,
      voteCount: profile.voteCount,
      lastUpdated: profile.lastSummarizedAt,
      version: profile.version,
    })
  } catch (error) {
    console.error('[GET /api/user/trade-profile]', error)
    return NextResponse.json(
      { error: 'Failed to fetch trade profile' },
      { status: 500 }
    )
  }
}
