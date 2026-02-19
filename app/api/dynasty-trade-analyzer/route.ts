import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { openaiChatJson } from '@/lib/openai-client';

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sideA, sideB, leagueContext } = await req.json();

  if (!sideA || !sideB) {
    return NextResponse.json(
      { error: 'Both sides of the trade are required' },
      { status: 400 },
    );
  }

  const systemPrompt = `You are a top dynasty fantasy football analyst. You must return ONLY valid JSON. Never hallucinate player stats or values — if uncertain, say so. Use realistic dynasty valuation logic grounded in age curves, positional scarcity, draft capital value, and long-term production windows.`;

  const userPrompt = `Evaluate this trade in a dynasty context (${leagueContext || 'standard SF PPR'}).

Trade:
Team A receives: ${sideA}
Team B receives: ${sideB}

Output JSON only:
{
  "winner": "Team A" | "Team B" | "Even" | "Slight edge to Team A" | "Slight edge to Team B",
  "valueDelta": "short explanation of value difference (e.g. Team A wins by ~15-20% long-term value)",
  "factors": ["array of 4-7 bullet points explaining key reasons (aging, position scarcity, future picks, etc.)"],
  "confidence": number 0-100
}`;

  try {
    const result = await openaiChatJson({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.45,
      maxTokens: 1024,
    });

    if (!result.ok) {
      console.error('[dynasty-trade-analyzer] AI error:', result.details);
      return NextResponse.json(
        { error: 'Analysis failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ analysis: result.json });
  } catch (err) {
    console.error('[dynasty-trade-analyzer] Error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
