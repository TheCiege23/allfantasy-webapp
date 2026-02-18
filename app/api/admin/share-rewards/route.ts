import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/share-rewards", tool: "AdminShareRewards" })(async (req: NextRequest) => {
  try {
    if (!isAuthorizedRequest(req)) return adminUnauthorized()

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [rewards, totalShares, totalTokensResult, uniqueUsersResult, todayShares, unredeemed] = await Promise.all([
      prisma.shareReward.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.shareReward.count(),
      prisma.shareReward.aggregate({
        _sum: { tokensAwarded: true }
      }),
      prisma.shareReward.groupBy({
        by: ['sleeperUsername'],
        _count: true
      }),
      prisma.shareReward.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.shareReward.count({
        where: { redeemed: false }
      })
    ])

    return NextResponse.json({
      rewards,
      stats: {
        totalShares,
        totalTokensAwarded: totalTokensResult._sum.tokensAwarded || 0,
        uniqueUsers: uniqueUsersResult.length,
        todayShares,
        unredeemed
      },
      pagination: {
        page,
        limit,
        total: totalShares
      }
    })
  } catch (error) {
    console.error('Admin share rewards error:', error)
    return NextResponse.json({ error: 'Failed to fetch share rewards' }, { status: 500 })
  }
})
