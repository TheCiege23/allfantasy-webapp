import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { withApiUsage } from '@/lib/telemetry/usage'

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
})

function buildFullPrompt(ctx: {
  tradeText: string
  leagueSize: number
  scoring: string
  isDynasty: boolean
  currentVerdict: string
  currentFairness: number
  leagueSettings?: any
  userRoster?: string
  userFAABRemaining?: number
  userContentionWindow?: string
  userRecord?: string
}) {
  const {
    tradeText, leagueSize, scoring, isDynasty, currentVerdict, currentFairness,
    leagueSettings, userRoster, userFAABRemaining, userContentionWindow, userRecord,
  } = ctx

  const format = isDynasty ? 'Dynasty' : 'Redraft'
  const scoringLabel = scoring.toUpperCase()
  const settingsJson = leagueSettings ? JSON.stringify(leagueSettings) : 'Not provided'
  const contention = userContentionWindow || 'unknown'
  const record = userRecord || 'Unknown'
  const faab = userFAABRemaining != null ? `${userFAABRemaining}%` : 'Not provided'
  const roster = userRoster || 'No roster provided'
  const fairnessStr = `${currentFairness >= 0 ? '+' : ''}${currentFairness}%`

  return `You are the world's most accurate, league-specific, roster-aware fantasy football trade negotiator for 2025-2026 seasons.
Your analysis must be hyper-personalized to the user's exact situation — no generic advice.

=== LEAGUE & USER CONTEXT ===
League size: ${leagueSize}-team
Format: ${format}
Scoring: ${scoringLabel}
Full league settings: ${settingsJson}
User's contention window: ${contention}
User's current record: ${record}
User's FAAB remaining: ${faab}

User's roster (critical for replacement level, positional needs, surplus, age curve, contention fit):
"""
${roster}
"""

Trade being evaluated (user is the "I give" / "you" side):
"""
${tradeText}
"""

Current AI verdict: ${currentVerdict}
Current value delta: ${fairnessStr} (positive = better for user)

=== TASK ===
Generate 3–5 highly realistic, personalized counter-offer suggestions that meaningfully improve the deal for the user.

Take EVERYTHING into account:
- Exact positional scarcity based on league starters, bench size, flex rules, TE-premium, Superflex
- User's roster needs / surplus / age / injury risk / contention window
- Dynasty-specific value: future picks (early/mid/late adjusted for league size/format), rookie draft outlook (college prospects, landing spots, team needs)
- Volatility: boom/bust players, injury history, contract situations
- FAAB implications if relevant
- Trade history tendencies in this league (if implied by context)
- Acceptance likelihood — suggest counters a rational opponent would consider

For each suggestion return:
- Short title (8–15 words)
- Exact natural-language counter-offer text (copy-paste ready, "I give: X\\nI get: Y" format)
- Estimated new fairness impact (e.g. "+18% for you", "now strong win", "higher acceptance chance")
- 3–5 concise, specific bullets explaining WHY it's better (reference roster, league settings, contention, etc.)
- Optional sensitivity note (one sentence) — e.g. "Only if you're truly win-now", "Avoid if rebuilding", null if not needed

Rules:
- Be brutally honest — never suggest trades that hurt the user
- Prioritize high-acceptance counters: depth swaps, future picks, small upgrades
- In dynasty: weight youth, picks, long-term upside heavily
- If no roster provided, fall back to general positional scarcity but note limitation
- Keep language clear, confident, conversational — like advising a league mate
- Order from most to least likely to be accepted

Return ONLY valid JSON — nothing else:
{
  "suggestions": [
    {
      "title": "string (8-15 words)",
      "counter": "exact copy-paste offer string (I give: X\\nI get: Y)",
      "impact": "string like +15% for you",
      "reasons": ["max 12 words each", "3-5 bullets"],
      "sensitivityNote": "string or null"
    }
  ]
}`
}

function parseSuggestions(parsed: any) {
  const rawList = Array.isArray(parsed) ? parsed : parsed?.suggestions
  if (!rawList || !Array.isArray(rawList) || rawList.length === 0) return null
  return rawList.slice(0, 5).map((s: any) => ({
    title: String(s.title || 'Alternative trade'),
    counter: String(s.counter || s.counterOfferText || ''),
    impact: String(s.impact || s.estimatedImpact || ''),
    reasons: Array.isArray(s.reasons || s.whyBetter) ? (s.reasons || s.whyBetter).map(String).slice(0, 5) : [],
    sensitivityNote: s.sensitivityNote ? String(s.sensitivityNote) : null,
  }))
}

export const POST = withApiUsage({ endpoint: '/api/instant/improve-trade', tool: 'ImproveTradeAI' })(async (req: Request) => {
  try {
    const ip = getClientIp(req as any) || 'unknown'
    const rl = rateLimit(`improve-trade:${ip}`, 5, 60_000)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429 }
      )
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const { tradeText, currentVerdict, currentFairness } = body
    const shouldStream = body.stream !== false
    const leagueSize = typeof body.leagueSize === 'number' && [8, 10, 12, 14, 16, 32].includes(body.leagueSize) ? body.leagueSize : 12
    const scoring = ['ppr', 'half', 'standard', 'superflex'].includes(body.scoring) ? body.scoring : 'ppr'
    const isDynasty = typeof body.isDynasty === 'boolean' ? body.isDynasty : true
    const leagueSettings = body.leagueSettings && typeof body.leagueSettings === 'object' ? body.leagueSettings : undefined
    const userRoster = typeof body.userRoster === 'string' && body.userRoster.trim() ? body.userRoster.trim().slice(0, 2000) : undefined
    const userFAABRemaining = typeof body.userFAABRemaining === 'number' ? Math.max(0, Math.min(100, body.userFAABRemaining)) : undefined
    const userContentionWindow = ['win-now', 'contender', 'rebuild', 'retooling'].includes(body.userContentionWindow) ? body.userContentionWindow : undefined
    const userRecord = typeof body.userRecord === 'string' && body.userRecord.trim() ? body.userRecord.trim().slice(0, 20) : undefined

    if (!tradeText || typeof tradeText !== 'string' || tradeText.trim().length < 5) {
      return NextResponse.json({ error: 'Trade text is required.' }, { status: 400 })
    }

    if (tradeText.length > 1000) {
      return NextResponse.json({ error: 'Trade text is too long.' }, { status: 400 })
    }

    if (req.signal?.aborted) {
      return new Response('Request aborted', { status: 499 })
    }

    const percentDiff = typeof currentFairness === 'number' ? currentFairness : 0
    const systemPrompt = buildFullPrompt({
      tradeText, leagueSize, scoring, isDynasty,
      currentVerdict: currentVerdict || 'unknown', currentFairness: percentDiff,
      leagueSettings, userRoster, userFAABRemaining, userContentionWindow, userRecord,
    })

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the counter-offer suggestions now. Return only JSON.' },
    ]

    if (shouldStream) {
      const stream = await xai.chat.completions.create({
        model: 'grok-4-0709',
        messages,
        temperature: 0.6,
        max_tokens: 1600,
        response_format: { type: 'json_object' },
        stream: true,
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let accumulated = ''
            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta?.content || ''
              if (delta) {
                accumulated += delta
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta, accumulated })}\n\n`))
              }
            }

            let parsed: any
            try {
              parsed = JSON.parse(accumulated)
            } catch {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Could not parse AI suggestions.' })}\n\n`))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }

            const suggestions = parseSuggestions(parsed)
            if (!suggestions || suggestions.length === 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI returned no suggestions.' })}\n\n`))
            } else {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ suggestions, done: true })}\n\n`))
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (err: any) {
            console.error('[improve-trade] Stream error:', err?.message || err)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed. Please try again.' })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          }
        },
      })

      return new Response(readable, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const completion = await xai.chat.completions.create({
      model: 'grok-4-0709',
      messages,
      temperature: 0.6,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0]?.message?.content || '{}'

    let parsed: any
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      console.error('[improve-trade] Invalid JSON from Grok:', rawContent.slice(0, 200))
      return NextResponse.json(
        { error: 'Could not parse AI suggestions. Please try again.' },
        { status: 500 }
      )
    }

    const suggestions = parseSuggestions(parsed)
    if (!suggestions || suggestions.length === 0) {
      console.error('[improve-trade] No suggestions in response')
      return NextResponse.json(
        { error: 'AI returned no suggestions. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ suggestions })
  } catch (err: any) {
    console.error('[improve-trade] Unexpected error:', err?.message || err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
})
