import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { addFeedback, getRecentFeedback } from '@/lib/feedback-store'
import { persistVote, getRecentVotesForUser } from '@/lib/trade-feedback-profile'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown'
    const rl = rateLimit(`feedback-trade:${ip}`, 20, 60_000)
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
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
      userRoster,
      userContention,
    } = body

    if (!tradeText || !suggestionTitle || !vote || !['up', 'down'].includes(vote)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    addFeedback({
      timestamp: new Date().toISOString(),
      tradeText: String(tradeText).slice(0, 1000),
      suggestionTitle: String(suggestionTitle).slice(0, 200),
      suggestionText: String(suggestionText || '').slice(0, 1000),
      vote,
      reason: typeof reason === 'string' ? reason.slice(0, 100) : null,
      leagueSize: typeof leagueSize === 'number' ? leagueSize : null,
      isDynasty: typeof isDynasty === 'boolean' ? isDynasty : null,
      scoring: typeof scoring === 'string' ? scoring.slice(0, 20) : null,
      userRoster: typeof userRoster === 'string' ? userRoster.slice(0, 2000) : null,
      userContention: typeof userContention === 'string' ? userContention.slice(0, 20) : 'unknown',
    })

    let profileUpdated = false
    try {
      const session = await getServerSession(authOptions)
      const userId = (session?.user as any)?.id
      if (userId) {
        await persistVote({
          userId,
          tradeText: String(tradeText),
          suggestionTitle: String(suggestionTitle),
          suggestionText: suggestionText ? String(suggestionText) : undefined,
          vote: vote as 'up' | 'down',
          reason: typeof reason === 'string' ? reason : undefined,
          leagueSize: typeof leagueSize === 'number' ? leagueSize : undefined,
          isDynasty: typeof isDynasty === 'boolean' ? isDynasty : undefined,
          scoring: typeof scoring === 'string' ? scoring : undefined,
          userRoster: typeof userRoster === 'string' ? userRoster : undefined,
          userContention: typeof userContention === 'string' ? userContention : undefined,
        })
        profileUpdated = true
      }
    } catch (err) {
      console.error('[feedback/trade] DB persist failed (continuing with in-memory):', err)
    }

    return NextResponse.json({ success: true, persisted: profileUpdated })
  } catch (error) {
    console.error('[feedback/trade]', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (userId) {
      const votes = await getRecentVotesForUser(userId, 50)
      return NextResponse.json({
        feedback: votes.map(v => ({
          tradeText: v.tradeText,
          suggestionTitle: v.suggestionTitle,
          suggestionText: v.suggestionText,
          vote: v.vote,
          leagueSize: v.leagueSize,
          isDynasty: v.isDynasty,
          scoring: v.scoring,
          timestamp: v.createdAt.toISOString(),
        })),
        source: 'database',
      })
    }

    return NextResponse.json({ feedback: getRecentFeedback(50), source: 'memory' })
  } catch {
    return NextResponse.json({ feedback: getRecentFeedback(50), source: 'memory' })
  }
}
