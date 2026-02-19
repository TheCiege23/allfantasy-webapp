import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { openaiChatJson } from '@/lib/openai-client';
import { z } from 'zod';

const requestSchema = z.object({
  playerName: z.string().min(1),
  position: z.string().optional(),
  leagueContext: z.string().optional(),
});

async function lookupPlayerContext(playerName: string) {
  try {
    const player = await (prisma as any).sportsPlayer.findFirst({
      where: { name: { contains: playerName, mode: 'insensitive' }, sport: 'nfl' },
      select: { name: true, position: true, team: true, age: true, status: true },
    });
    return player;
  } catch {
    return null;
  }
}

async function lookupTradeInsight(playerName: string) {
  try {
    const insight = await (prisma as any).tradeLearningInsight.findFirst({
      where: { playerName: { contains: playerName, mode: 'insensitive' } },
      select: { avgValueGiven: true, avgValueReceived: true, winRate: true, marketTrend: true, sampleSize: true },
    });
    return insight;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const playerName = searchParams.get('name');

  if (!playerName) {
    return NextResponse.json({ error: 'name parameter required' }, { status: 400 });
  }

  const [playerContext, tradeInsight] = await Promise.all([
    lookupPlayerContext(playerName),
    lookupTradeInsight(playerName),
  ]);

  if (playerContext) {
    return NextResponse.json({
      name: playerContext.name,
      position: playerContext.position,
      team: playerContext.team,
      age: playerContext.age,
      status: playerContext.status,
      tradeInsight: tradeInsight || null,
      source: 'database',
    });
  }

  return NextResponse.json({ value: null, source: 'not_found' });
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
  }

  const { playerName, position, leagueContext } = parsed.data;

  try {
    const [playerContext, tradeInsight] = await Promise.all([
      lookupPlayerContext(playerName),
      lookupTradeInsight(playerName),
    ]);

    let groundingContext = '';
    if (playerContext) {
      groundingContext += `\nDB Context: ${playerContext.name}, ${playerContext.position || 'unknown pos'}, ${playerContext.team || 'FA'}, age ${playerContext.age || 'unknown'}, status: ${playerContext.status || 'active'}`;
    }
    if (tradeInsight && tradeInsight.sampleSize > 0) {
      groundingContext += `\nTrade History: ${tradeInsight.sampleSize} trades observed, avg value given: ${tradeInsight.avgValueGiven?.toFixed(0) || '?'}, avg value received: ${tradeInsight.avgValueReceived?.toFixed(0) || '?'}, market trend: ${tradeInsight.marketTrend || 'unknown'}`;
    }

    const result = await openaiChatJson({
      messages: [
        {
          role: 'system',
          content: `You are a dynasty fantasy football trade value expert. Provide a quick dynasty trade value assessment for players. Use only provided data and your training data — never invent stats. Be concise and honest. Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Quick dynasty value check for: ${playerName}${position ? ` (${position})` : ''}
${leagueContext ? `League: ${leagueContext}` : '12-team SF PPR dynasty'}${groundingContext}

Return JSON:
{
  "value": number from 1-100 (100 = elite like Mahomes in SF),
  "tier": "Elite" | "Star" | "Starter" | "Depth" | "Roster Clogger",
  "trend": "Rising" | "Stable" | "Declining",
  "summary": "1 sentence value summary",
  "comparables": ["1-2 similar-value players"]
}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 300,
    });

    if (!result.ok) {
      console.error('[player-value] AI error:', result.details);
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
    }

    return NextResponse.json(result.json);
  } catch (err) {
    console.error('[player-value] Error:', err);
    return NextResponse.json({ error: 'Failed to get player value' }, { status: 500 });
  }
}
