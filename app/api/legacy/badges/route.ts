import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { getUserBadges, getUserTotalXP, getBadgeDefinitions } from '@/lib/badge-engine'
import { requireAuthOrOrigin, forbiddenResponse } from '@/lib/api-auth'

export const GET = withApiUsage({ endpoint: "/api/legacy/badges", tool: "LegacyBadges" })(async (request: NextRequest) => {
  const auth = requireAuthOrOrigin(request)
  if (!auth.authenticated) {
    return forbiddenResponse(auth.error || 'Unauthorized')
  }

  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')
  const showAll = searchParams.get('all') === 'true'

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 })
  }

  try {
    const userBadges = await getUserBadges(username)
    const totalXP = await getUserTotalXP(username)

    const response: any = {
      badges: userBadges.map(b => ({
        id: b.id,
        type: b.badgeType,
        name: b.badgeName,
        description: b.description,
        tier: b.tier,
        xp: b.xpReward,
        icon: (b.data as any)?.icon || '🏅',
        earnedAt: b.earnedAt,
      })),
      totalBadges: userBadges.length,
      totalXP,
    }

    if (showAll) {
      const allDefs = getBadgeDefinitions()
      const earnedTypes = new Set(userBadges.map(b => b.badgeType))
      response.available = Object.entries(allDefs)
        .filter(([key]) => !earnedTypes.has(key))
        .map(([key, def]) => ({
          type: key,
          name: def.badgeName,
          description: def.description,
          tier: def.tier,
          xp: def.xpReward,
          icon: def.icon,
          locked: true,
        }))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch badges:', error)
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 })
  }
})
