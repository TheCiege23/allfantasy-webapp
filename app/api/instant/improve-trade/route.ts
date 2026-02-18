import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { withApiUsage } from '@/lib/telemetry/usage'

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
})

const IMPROVE_TRADE_SYSTEM_PROMPT = `You are the world's best dynasty & redraft fantasy football trade negotiator. You are AGGRESSIVE — your goal is to flip bad trades into clearly positive ones, or at minimum make them neutral. You are not afraid to ask for significant upgrades: star-for-star-plus-pick swaps, young upside players bundled with picks, or position upgrades that meaningfully change the deal. Still keep it realistic — no absurd asks like "give me Mahomes for free."

Your tone is professional yet approachable — like talking to a league mate. Keep language conversational in counter-offer text.

Generate exactly 4 plausible, creative counter-offer suggestions that improve the deal for the "you" side.

Rules:
- Base suggestions on general 2025–2026 dynasty/redraft market knowledge and positional scarcity
- Do NOT invent specific player rankings, ADPs, or exact trade values — reason qualitatively
- Prioritize high acceptance likelihood (>60–70%) — the other manager must realistically say yes
- Prefer balanced asks: mid/late future picks (2nd, 3rd rounders), depth/similar-position swaps, or small upgrades over demanding massive overpays
- If close to even, focus on small targeted upgrades, not huge overpays
- If already good for "you", suggest modest sweeteners to increase acceptance odds
- If bad for "you", focus on realistic fixes that flip it to neutral or positive
- Never propose counters that obviously worsen the deal for the user
- Order from most to least likely to be accepted
- Keep bullet reasons under 12 words each

Return ONLY valid JSON — no extra text, no markdown, no explanations outside the JSON.

{
  "suggestions": [
    {
      "title": "short string (8-15 words)",
      "counter": "exact copy-paste offer string (I give: X\\nI get: Y)",
      "impact": "+15%",
      "reasons": ["max 12 words each", "3-4 bullets", "concise and specific"]
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

    const userPrompt = `You are an elite dynasty fantasy football GM.

Examples of great counter suggestions:

Example 1:
Original: I give: Justin Jefferson   I get: Garrett Wilson + 2026 1st
Verdict: Slightly bad for you

Good suggestion:
{"title":"Add your late 2nd to balance","counter":"I give: Justin Jefferson + my 2026 2.10\\nI get: Garrett Wilson + 2026 early 1st","impact":"Now even to slight edge for you","reasons":["Late 2nd has low cost in dynasty","Early 1st has significantly more value","Makes the pick premium feel fair to opponent"]}

Example 2:
Original: I give: Breece Hall   I get: Jahmyr Gibbs + Christian Watson
Verdict: Bad for you

Good suggestion:
{"title":"Swap Watson for better WR or pick","counter":"I give: Breece Hall\\nI get: Jahmyr Gibbs + Drake London / Zay Flowers","impact":"+20–30% for you","reasons":["London/Flowers >> Watson in dynasty value","Maintains RB youth/upside","Much stronger WR return"]}

Now do the same quality for this trade:

League: ${leagueSize}-team ${scoring.toUpperCase()} ${isDynasty ? 'dynasty' : 'redraft'}
Trade: """
${tradeText}
"""
Current verdict: ${currentVerdict || 'unknown'}
Current delta: ${percentDiff >= 0 ? '+' : ''}${percentDiff}%

Return only JSON with "suggestions" array of 4 items matching the example format.`

    const completion = await xai.chat.completions.create({
      model: 'grok-4-0709',
      messages: [
        { role: 'system', content: IMPROVE_TRADE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 1400,
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

    const rawList = Array.isArray(parsed) ? parsed : parsed?.suggestions
    if (!rawList || !Array.isArray(rawList) || rawList.length === 0) {
      console.error('[improve-trade] No suggestions in response')
      return NextResponse.json(
        { error: 'AI returned no suggestions. Please try again.' },
        { status: 500 }
      )
    }

    const suggestions = rawList.slice(0, 4).map((s: any) => ({
      title: String(s.title || 'Alternative trade'),
      counter: String(s.counter || s.counterOfferText || ''),
      impact: String(s.impact || s.estimatedImpact || ''),
      reasons: Array.isArray(s.reasons || s.whyBetter) ? (s.reasons || s.whyBetter).map(String).slice(0, 4) : [],
    }))

    return NextResponse.json({ suggestions })
  } catch (err: any) {
    console.error('[improve-trade] Unexpected error:', err?.message || err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
})
