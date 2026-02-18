import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import OpenAI from 'openai';

const grok = new OpenAI({ apiKey: process.env.XAI_API_KEY!, baseURL: 'https://api.x.ai/v1' });

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit(`waiver-grok:${ip}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();

    const {
      userRoster,
      userContention,
      userFAAB,
      useRealTimeNews,
      leagueSize = 12,
      scoring = 'ppr',
      isDynasty = true,
    } = body;

    if (!userRoster || typeof userRoster !== 'string' || !userRoster.trim()) {
      return NextResponse.json({ error: 'Roster is required' }, { status: 400 });
    }

    const realTimeClause = useRealTimeNews
      ? `\n\nREAL-TIME DATA ENABLED: Factor in the latest injuries, transactions, signings, coaching changes, rookie draft capital/landing spots, and breaking news buzz when evaluating targets. Flag any time-sensitive pickups.`
      : '';

    const systemPrompt = `You are the #1 Waiver Wire AI for 2026 fantasy football.
Analyze the user's roster, contention window, FAAB budget, and league context to surface the highest-impact waiver targets.

League Context:
- Format: ${leagueSize}-team ${isDynasty ? 'Dynasty' : 'Redraft'} ${scoring.toUpperCase()}
- Contention window: ${userContention}
- FAAB remaining: ${userFAAB}%

Current Roster:
"""
${userRoster}
"""

Prioritize waiver targets that:
1. Fill immediate roster holes based on the provided roster (identify positional weaknesses)
2. Fit the user's contention window (${userContention}) — win-now targets for contenders, stash/upside for rebuilders
3. Offer breakout upside or long-term stash value in dynasty formats
4. Replace potential busts, aging, or injury-prone players currently on the roster
5. Are realistic FAAB spends given ${userFAAB}% remaining budget — don't blow the budget on marginal upgrades
6. Consider roster construction holistically — depth vs ceiling, bye week coverage, handcuff value
${realTimeClause}

For each target, explain WHY they fit THIS specific roster and contention window. Be concrete — reference specific roster players they complement or replace.

If relevant, mention any players on the current roster that look like potential busts or sell-high candidates based on age, injury history, situation, or market trends. Include these as a separate "rosterAlerts" array.

Return 5–8 waiver targets ranked by priority.

Output ONLY valid JSON (no markdown, no code fences):
{
  "suggestions": [
    {
      "playerName": string,
      "rank": number,
      "score": number (0-100 composite fit score),
      "reason": string[] (2-4 specific reasons tied to this roster),
      "projectedPoints": number (weekly PPR projection),
      "faabBidRecommendation": number | null (% of total budget),
      "sensitivityNote": string | null (injury risk, usage concern, or upside caveat)
    }
  ],
  "rosterAlerts": [
    {
      "playerName": string,
      "alertType": "bust_risk" | "sell_high" | "injury_concern" | "aging_out",
      "reason": string
    }
  ]
}`;

    const response = await grok.chat.completions.create({
      model: 'grok-4-0709',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.7,
      max_tokens: 1800,
      stream: false,
    });

    const content = response.choices[0]?.message?.content || '{}';

    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[waiver-ai/grok]', error);
    return NextResponse.json({ error: 'Failed to generate waiver suggestions' }, { status: 500 });
  }
}
