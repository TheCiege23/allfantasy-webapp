import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { QUIZ_TRADES, calculatePreferences } from '@/lib/trade-quiz-data'

export const GET = withApiUsage({ endpoint: "/api/legacy/trade/preferences", tool: "LegacyTradePreferences" })(async (req: NextRequest) => {
  const url = new URL(req.url)
  const sleeperUsername = url.searchParams.get('sleeper_username')?.trim().toLowerCase()

  if (!sleeperUsername) {
    return NextResponse.json({ error: 'Missing sleeper_username' }, { status: 400 })
  }

  const prefs = await prisma.tradePreferences.findUnique({
    where: { sleeperUsername },
  })

  return NextResponse.json({
    hasCompletedQuiz: prefs?.quizCompleted ?? false,
    preferences: prefs ? {
      youthVsProduction: prefs.youthVsProduction,
      consolidationVsDepth: prefs.consolidationVsDepth,
      picksVsPlayers: prefs.picksVsPlayers,
      riskTolerance: prefs.riskTolerance,
      qbPriority: prefs.qbPriority,
      tePriority: prefs.tePriority,
    } : null,
    quizTrades: QUIZ_TRADES,
  })
})

export const POST = withApiUsage({ endpoint: "/api/legacy/trade/preferences", tool: "LegacyTradePreferences" })(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const sleeperUsername = String(body.sleeper_username || '').trim().toLowerCase()
    const responses = body.responses as Array<{ tradeId: number; choice: 'A' | 'B' }>

    if (!sleeperUsername) {
      return NextResponse.json({ error: 'Missing sleeper_username' }, { status: 400 })
    }

    if (!Array.isArray(responses) || responses.length < 5) {
      return NextResponse.json({ error: 'Must answer at least 5 questions' }, { status: 400 })
    }

    const calculatedPrefs = calculatePreferences(responses)

    const prefs = await prisma.tradePreferences.upsert({
      where: { sleeperUsername },
      create: {
        sleeperUsername,
        ...calculatedPrefs,
        quizCompleted: true,
        quizResponses: responses,
      },
      update: {
        ...calculatedPrefs,
        quizCompleted: true,
        quizResponses: responses,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      preferences: {
        youthVsProduction: prefs.youthVsProduction,
        consolidationVsDepth: prefs.consolidationVsDepth,
        picksVsPlayers: prefs.picksVsPlayers,
        riskTolerance: prefs.riskTolerance,
        qbPriority: prefs.qbPriority,
        tePriority: prefs.tePriority,
      },
    })
  } catch (e) {
    console.error('Trade preferences error:', e)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
})
