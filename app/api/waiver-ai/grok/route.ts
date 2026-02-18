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

    const systemPrompt = `You are the #1 Waiver Wire AI for 2026 fantasy football.
Analyze the user's roster, contention window, FAAB, and league context to find hidden gems.

Context:
- League: ${leagueSize}-team ${isDynasty ? 'Dynasty' : 'Redraft'} ${scoring.toUpperCase()}
- User contention: ${userContention}
- FAAB remaining: ${userFAAB}%
- Roster:\n"""\n${userRoster}\n"""

Use real-time tools if enabled. Prioritize:
- Breakout candidates & rookies with upside
- Injury replacements
- Depth/stash players that fit contention window
- FAAB bid recommendations (0–100% scale)

Return 5–8 waiver targets ranked by priority.

Output ONLY valid JSON (no markdown, no code fences):
{
  "suggestions": [
    {
      "playerName": string,
      "rank": number,
      "score": number,
      "reason": string[],
      "projectedPoints": number,
      "faabBidRecommendation": number | null,
      "sensitivityNote": string | null
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
