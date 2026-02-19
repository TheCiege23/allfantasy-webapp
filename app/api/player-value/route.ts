import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { openaiChatJson } from '@/lib/openai-client';
import { z } from 'zod';

const requestSchema = z.object({
  playerName: z.string().min(1),
  position: z.string().optional(),
  leagueContext: z.string().optional(),
});

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
    const result = await openaiChatJson({
      messages: [
        {
          role: 'system',
          content: `You are a dynasty fantasy football trade value expert. Provide a quick dynasty trade value assessment for players. Use only your training data — never invent stats. Be concise and honest. Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Quick dynasty value check for: ${playerName}${position ? ` (${position})` : ''}
${leagueContext ? `League: ${leagueContext}` : '12-team SF PPR dynasty'}

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
