import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

export const POST = withApiUsage({ endpoint: "/api/admin", tool: "Admin" })(async (request: NextRequest) => {
  try {
    const { password } = await request.json()
    
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const signups = await prisma.earlyAccessSignup.findMany({
      orderBy: { createdAt: 'desc' }
    })

    const questionnaires = await prisma.questionnaireResponse.findMany()

    const sportCounts: Record<string, number> = {}
    const leagueCounts: Record<string, number> = {}
    const experimentalCounts: Record<string, number> = {}

    questionnaires.forEach(q => {
      sportCounts[q.favoriteSport] = (sportCounts[q.favoriteSport] || 0) + 1
      leagueCounts[q.favoriteLeagueType] = (leagueCounts[q.favoriteLeagueType] || 0) + 1
      q.experimentalInterest.forEach(exp => {
        experimentalCounts[exp] = (experimentalCounts[exp] || 0) + 1
      })
    })

    return NextResponse.json({
      ok: true,
      signups,
      stats: {
        sportCounts,
        leagueCounts,
        experimentalCounts,
      }
    })
  } catch (error) {
    console.error('Admin error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
})
