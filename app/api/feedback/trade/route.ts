import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

let feedbackStore: any[] = []

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
      leagueSize,
      isDynasty,
      scoring,
      userRoster,
      userContention,
    } = body

    if (!tradeText || !suggestionTitle || !vote || !['up', 'down'].includes(vote)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const feedback = {
      timestamp: new Date().toISOString(),
      tradeText: String(tradeText).slice(0, 1000),
      suggestionTitle: String(suggestionTitle).slice(0, 200),
      suggestionText: String(suggestionText || '').slice(0, 1000),
      vote,
      leagueSize: typeof leagueSize === 'number' ? leagueSize : null,
      isDynasty: typeof isDynasty === 'boolean' ? isDynasty : null,
      scoring: typeof scoring === 'string' ? scoring.slice(0, 20) : null,
      userRoster: typeof userRoster === 'string' ? userRoster.slice(0, 2000) : null,
      userContention: typeof userContention === 'string' ? userContention.slice(0, 20) : 'unknown',
    }

    feedbackStore.push(feedback)

    if (feedbackStore.length > 500) {
      feedbackStore = feedbackStore.slice(-250)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[feedback/trade]', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ feedback: feedbackStore.slice(-50) })
}
