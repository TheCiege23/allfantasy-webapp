import { NextResponse } from 'next/server'
import { openaiChatJson, parseJsonContentFromChatCompletion } from '@/lib/openai-client'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { withApiUsage } from '@/lib/telemetry/usage'

const IMPROVE_TRADE_SYSTEM_PROMPT = `You are an expert fantasy football trade advisor. Given a trade the user is considering, suggest 2-3 alternative trades that would be BETTER for the user while remaining REALISTIC and FAIR.

RULES:
- Each suggestion should modify the original trade (add/remove/swap assets)
- Suggestions must be realistic — the other manager would plausibly accept
- Focus on improving value for the user WITHOUT creating lopsided trades
- Consider dynasty vs redraft context
- Consider league size and scoring format
- Include draft picks as sweeteners when appropriate

RESPOND IN THIS EXACT JSON FORMAT:
{
  "suggestions": [
    {
      "description": "Short title of the counter-offer (e.g. 'Add a 2nd to sweeten the deal')",
      "whyBetter": ["Reason 1 why this is better", "Reason 2"],
      "newVerdict": "Projected new verdict (e.g. 'Slight Win for You')",
      "deltaEstimate": "Estimated improvement (e.g. '+15% fairness')",
      "copyText": "Full trade text formatted as: I give: X + Y\\nI get: A + B"
    }
  ]
}

Return exactly 2-3 suggestions. Keep reasons concise (1 sentence each). Never suggest trades that exploit the other manager.`

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

    const userPrompt = `ORIGINAL TRADE:
${tradeText}

SETTINGS:
- League size: ${leagueSize || 12}-team
- Scoring: ${scoring || 'ppr'}
- Format: ${isDynasty ? 'Dynasty' : 'Redraft'}

CURRENT ANALYSIS:
- Verdict: ${currentVerdict || 'unknown'}
- Fairness gap: ${currentFairness || 0}%

Generate 2-3 improved counter-offer suggestions that would make this trade better for the user while remaining realistic and fair. Remember: both sides should feel like they gave up value but got better — never exploit the other manager.`

    const result = await openaiChatJson({
      messages: [
        { role: 'system', content: IMPROVE_TRADE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 800,
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

    const suggestions = parsed.suggestions.slice(0, 3).map((s: any) => ({
      description: String(s.description || 'Alternative trade'),
      whyBetter: Array.isArray(s.whyBetter) ? s.whyBetter.map(String) : [],
      newVerdict: s.newVerdict ? String(s.newVerdict) : undefined,
      deltaEstimate: s.deltaEstimate ? String(s.deltaEstimate) : undefined,
      copyText: String(s.copyText || s.description || ''),
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
