import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { openaiChatJson } from '@/lib/openai-client';
import { z } from 'zod';

const requestSchema = z.object({
  leagueId: z.string().min(1),
  rosterWeakness: z.string().optional(),
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
    return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
  }

  const { leagueId, rosterWeakness } = parsed.data;

  try {
    const league = await (prisma as any).league.findFirst({
      where: {
        OR: [
          { id: leagueId, userId: session.user.id },
          { externalId: leagueId, userId: session.user.id },
        ],
      },
      include: {
        teams: {
          include: {
            performances: { orderBy: { week: 'desc' }, take: 3 },
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const userTeam = league.teams?.find((t: any) => t.isUserTeam) || league.teams?.[0];
    const rosterSummary = userTeam
      ? `Team: ${userTeam.name || 'My Team'}. Record: ${userTeam.wins ?? '?'}-${userTeam.losses ?? '?'}. Roster: ${(userTeam.roster || []).map((p: any) => `${p.name || p.player_name} (${p.position || p.pos})`).join(', ') || 'unknown'}`
      : 'No team data available';

    const leagueContext = `League: ${league.name || leagueId}. Format: ${league.format || 'redraft'}. Scoring: ${league.scoringType || 'PPR'}. Teams: ${league.teams?.length || '?'}. ${league.isSuperflex ? 'Superflex.' : ''} ${league.isDynasty ? 'Dynasty.' : ''}`;

    const systemPrompt = `You are an expert fantasy football waiver wire analyst. Analyze the user's league and team to suggest the best available waiver wire pickups. Focus on players likely to be on waivers (not stars). Consider recent trends, matchups, injuries, and roster needs. Return ONLY valid JSON.`;

    const positionFocus = rosterWeakness ? `\nFOCUS: Prioritize ${rosterWeakness} suggestions - the user specifically needs help at this position.` : '';

    const userPrompt = `Based on this league and team context, suggest 5-8 waiver wire targets.

${leagueContext}
${rosterSummary}${positionFocus}

Return JSON:
{
  "suggestions": [
    {
      "playerName": "string",
      "position": "QB|RB|WR|TE|K|DEF",
      "team": "NFL team abbreviation",
      "reason": "1-2 sentence explanation of why to add this player",
      "priority": number 1-10 (10 = must add)
    }
  ]
}

Sort by priority descending. Be specific about matchups and usage trends. Only suggest realistic waiver adds, not rostered stars.`;

    const result = await openaiChatJson({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      maxTokens: 1500,
    });

    if (!result.ok) {
      console.error('[waiver-ai-suggest] AI error:', result.details);
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
    }

    const suggestions = result.json?.suggestions || [];

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('[waiver-ai-suggest] Error:', err);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
