import { NextResponse } from 'next/server'
import { openaiChatJson, parseJsonContentFromChatCompletion } from '@/lib/openai-client'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { withApiUsage } from '@/lib/telemetry/usage'

const IMPROVE_TRADE_SYSTEM_PROMPT = `You are the world's best dynasty & redraft fantasy football trade negotiator. Your goal is to help the user improve an unfair or even trade so it becomes clearly advantageous for them (the "you" side).

Your task:
Generate 3–5 realistic, creative but plausible counter-offer suggestions that would improve the deal for the "you" side.

For each suggestion:
1. Short title/description (8–15 words)
2. The exact counter-offer text in natural language (ready to copy-paste into league chat)
3. Estimated new fairness impact (e.g. "+12–18% for you", "now even", "slightly in your favor")
4. 3–5 short bullet points explaining WHY this is better / more fair / more likely to be accepted
5. One optional "sensitivity note" (when relevant): e.g. "Only do this if you need WR depth", "Avoid if you're already thin at QB"

Rules:
- Suggestions must be realistic for 2025–2026 dynasty/redraft values
- Do NOT invent fake player values or rankings — reason based on general market knowledge
- Prefer adding future picks, depth players, or swapping similar-position assets over massive overpays
- If the original trade is already very good for "you", suggest small sweeteners to increase acceptance chance
- If the trade is bad for "you", focus on fixes that bring it closer to even or better
- Never suggest trades that obviously make the deal worse for the user

Return ONLY valid JSON in this exact structure:

{
  "suggestions": [
    {
      "title": "Short title of the counter-offer",
      "counterOfferText": "I give: X + Y\\nI get: A + B",
      "estimatedImpact": "+12–18% for you",
      "whyBetter": ["Reason 1", "Reason 2", "Reason 3"],
      "sensitivityNote": "Optional context note or null"
    }
  ]
}`

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
    const leagueSize = typeof body.leagueSize === 'number' && [8, 10, 12, 14, 16, 32].includes(body.leagueSize) ? body.leagueSize : 12
    const scoring = ['ppr', 'half', 'standard', 'superflex'].includes(body.scoring) ? body.scoring : 'ppr'
    const isDynasty = typeof body.isDynasty === 'boolean' ? body.isDynasty : true

    if (!tradeText || typeof tradeText !== 'string' || tradeText.trim().length < 5) {
      return NextResponse.json({ error: 'Trade text is required.' }, { status: 400 })
    }

    if (tradeText.length > 1000) {
      return NextResponse.json({ error: 'Trade text is too long.' }, { status: 400 })
    }

    const percentDiff = typeof currentFairness === 'number' ? currentFairness : 0

    const userPrompt = `Current trade context:
League format: ${leagueSize}-team ${isDynasty ? 'dynasty' : 'redraft'} league
Scoring: ${scoring.toUpperCase()} (assume standard starting requirements unless told otherwise)
Trade text: """
${tradeText}
"""

Current AI analysis verdict: ${currentVerdict || 'unknown'}
Current value delta: ${percentDiff >= 0 ? '+' : ''}${percentDiff}% (positive = better for "you")

Generate 3–5 realistic counter-offer suggestions that improve the deal for the "you" side while remaining plausible for the other manager to accept.`

    const result = await openaiChatJson({
      messages: [
        { role: 'system', content: IMPROVE_TRADE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 1200,
    })

    if (!result.ok) {
      console.error('[improve-trade] OpenAI call failed')
      return NextResponse.json(
        { error: 'AI engine is temporarily unavailable. Please try again.' },
        { status: 503 }
      )
    }

    const parsed = parseJsonContentFromChatCompletion(result.json)
    if (!parsed || !parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      console.error('[improve-trade] Invalid AI response format')
      return NextResponse.json(
        { error: 'Could not parse AI suggestions. Please try again.' },
        { status: 500 }
      )
    }

    const suggestions = parsed.suggestions.slice(0, 5).map((s: any) => ({
      title: String(s.title || s.description || 'Alternative trade'),
      counterOfferText: String(s.counterOfferText || s.copyText || ''),
      estimatedImpact: String(s.estimatedImpact || s.deltaEstimate || ''),
      whyBetter: Array.isArray(s.whyBetter) ? s.whyBetter.map(String).slice(0, 5) : [],
      sensitivityNote: s.sensitivityNote && s.sensitivityNote !== 'null' ? String(s.sensitivityNote) : null,
    }))

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('[improve-trade] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
})
