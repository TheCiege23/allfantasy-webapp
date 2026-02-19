import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const bodySchema = z.object({
  leagueId: z.string(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { leagueId } = bodySchema.parse(json);

    const teams = await prisma.leagueTeam.findMany({
      where: { leagueId },
      orderBy: { pointsFor: 'desc' },
    });

    if (teams.length === 0) {
      return NextResponse.json({ error: 'No teams found' }, { status: 404 });
    }

    const prompt = `
You are a fantasy football expert. Given these teams' current stats:
${teams.map(t => `- ${t.teamName} (${t.ownerName}): ${t.pointsFor} pts, ${t.wins}-${t.losses}${t.ties > 0 ? `-${t.ties}` : ''}`).join('\n')}

For each team, output a JSON object with a "teams" array. Each entry:
- teamExternalId: string (use the team's externalId)
- adjustedPowerScore: number (0-100, consider rest-of-season projection, roster strength, record quality)
- projectedWins: number (projected total wins for the season)
- strength: short phrase (key competitive advantage)
- risk: short phrase (biggest vulnerability)
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    const updates = result.teams || [];

    await Promise.all(
      updates.map(async (u: any) => {
        await prisma.leagueTeam.updateMany({
          where: { externalId: u.teamExternalId, leagueId },
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
