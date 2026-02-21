import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' });

const bodySchema = z.object({
  leagueId: z.string(),
});

export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as {
      user?: { id?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const json = await req.json();
    const { leagueId } = bodySchema.parse(json);

    const teams = await (prisma as any).leagueTeam.findMany({
      where: { leagueId },
      include: { performances: { orderBy: { week: 'asc' } } },
      orderBy: { pointsFor: 'desc' },
    });

    if (teams.length === 0) {
      return NextResponse.json({ error: 'No teams found' }, { status: 404 });
    }

    const cachedPlayers = await (prisma as any).sportsPlayer.findMany({
      where: { sport: 'nfl' },
      take: 30,
      orderBy: { fetchedAt: 'desc' },
    });

    const prompt = `You are an elite fantasy football GM with 15+ years experience.
Use ONLY the following real data to evaluate these teams. Do not hallucinate or invent data.

Teams:
${teams.map((t: any) => {
  const weeklyPoints = t.performances?.map((p: any) => p.points) || [];
  const trend = weeklyPoints.length > 0 ? weeklyPoints.join(', ') : 'no weekly data';
  const recentAvg = weeklyPoints.length >= 3
    ? (weeklyPoints.slice(-3).reduce((a: number, b: number) => a + b, 0) / 3).toFixed(1)
    : 'N/A';
  return `- ${t.teamName} (${t.ownerName}): Record ${t.wins}-${t.losses}${t.ties > 0 ? `-${t.ties}` : ''}, Total PF: ${t.pointsFor.toFixed(1)}, PA: ${t.pointsAgainst.toFixed(1)}, Weekly trend: [${trend}], Last 3 avg: ${recentAvg}`;
}).join('\n')}

${cachedPlayers.length > 0 ? `\nRecent NFL players in database: ${cachedPlayers.slice(0, 15).map((p: any) => `${p.name} (${p.position || '?'}, ${p.team || '?'})`).join(', ')}` : ''}

For each team, analyze:
1. Scoring consistency and trajectory (trending up, down, or steady)
2. Record quality relative to points scored (lucky or unlucky)
3. Rest-of-season outlook based on recent performance
4. Key competitive advantages and vulnerabilities

Return a JSON object with a "teams" array. Each entry must have:
- "externalId": string (the team's external ID)
- "adjustedPowerScore": number 0-100 (weight recent performance heavily)
- "projectedWins": number (projected total wins for the season)
- "strength": string (one concise phrase about their key advantage)
- "risk": string (one concise phrase about their biggest vulnerability)
- "confidence": number 0-100 (how confident you are in this assessment)

Team external IDs: ${teams.map((t: any) => `${t.teamName}=${t.externalId}`).join(', ')}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    const updates = result.teams || [];

    await Promise.all(
      updates.map(async (u: any) => {
        await (prisma as any).leagueTeam.updateMany({
          where: { externalId: u.externalId, leagueId },
          data: {
            aiPowerScore: u.adjustedPowerScore,
            projectedWins: u.projectedWins,
            strengthNotes: u.strength,
            riskNotes: u.risk,
          },
        });
      })
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error('[Rankings API]', error);
    return NextResponse.json({ error: 'Failed to compute rankings' }, { status: 500 });
  }
}
