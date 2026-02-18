import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { FeedbackReason, VoteType } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { FEEDBACK_REASONS } from '@/lib/feedback-reasons'
import { summarizeUserTradeProfile } from '@/lib/summarizeTradeProfile'

const ENUM_TO_LABEL: Record<string, string> = Object.fromEntries(
  FEEDBACK_REASONS.map(r => [r.enum, r.label])
)

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown'
    const rl = rateLimit(`feedback-trade:${ip}`, 20, 60_000)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    const {
      tradeText,
      suggestionTitle,
      suggestionText,
      vote,
      reason,
      leagueSize,
      isDynasty,
      scoring,
      userContention,
      userRoster,
    } = body

    if (!vote || !['UP', 'DOWN'].includes(vote)) {
      return NextResponse.json({ error: 'Invalid vote' }, { status: 400 })
    }

    await prisma.feedback.create({
      data: {
        userId,
        tradeText: tradeText || null,
        suggestionTitle: suggestionTitle || null,
        suggestionText: suggestionText || null,
        vote: vote as VoteType,
        reason: vote === 'DOWN' && reason ? (reason as FeedbackReason) : null,
        leagueSize: leagueSize ?? null,
        isDynasty: isDynasty ?? null,
        scoring: scoring ?? null,
        userContention: userContention ?? null,
        userRoster: userRoster ?? null,
      },
    })

    summarizeUserTradeProfile(userId).catch(err =>
      console.error('Summarization error:', err)
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/feedback/trade]', error)
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const votes = await prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      feedback: votes.map(v => ({
        tradeText: v.tradeText,
        suggestionTitle: v.suggestionTitle,
        suggestionText: v.suggestionText,
        vote: v.vote,
        reason: v.reason ? (ENUM_TO_LABEL[v.reason] || v.reason) : null,
        leagueSize: v.leagueSize,
        isDynasty: v.isDynasty,
        scoring: v.scoring,
        timestamp: v.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[GET /api/feedback/trade]', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}
