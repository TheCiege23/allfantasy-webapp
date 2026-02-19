import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const bodySchema = z.object({
  leagueId: z.string(),
  teamId: z.string().optional(),
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
    const { leagueId, teamId } = bodySchema.parse(json);

    const league = await (prisma as any).league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        sport: true,
        season: true,
        scoring: true,
        leagueSize: true,
        isDynasty: true,
        settings: true,
        userId: true,
      },
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    if (league.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const teams = await (prisma as any).leagueTeam.findMany({
      where: { leagueId },
      include: {
        performances: { orderBy: { week: 'asc' } },
      },
      orderBy: { pointsFor: 'desc' },
    });

    if (teams.length === 0) {
      return NextResponse.json({ error: 'No teams found in this league' }, { status: 404 });
    }

    const rosters = await (prisma as any).roster.findMany({
      where: { leagueId },
    });

    const cachedPlayers = await (prisma as any).sportsPlayer.findMany({
      where: { sport: 'nfl' },
      take: 50,
      orderBy: { fetchedAt: 'desc' },
    });

    const playerMap = new Map<string, any>();
    for (const p of cachedPlayers) {
      if (p.sleeperId) playerMap.set(p.sleeperId, p);
      playerMap.set(p.externalId, p);
    }

    const teamsData = teams.map((t: any) => {
      const weeklyPoints = t.performances?.map((p: any) => p.points) || [];
      const recentAvg = weeklyPoints.length >= 3
        ? (weeklyPoints.slice(-3).reduce((a: number, b: number) => a + b, 0) / 3).toFixed(1)
        : null;
      const seasonAvg = weeklyPoints.length > 0
        ? (weeklyPoints.reduce((a: number, b: number) => a + b, 0) / weeklyPoints.length).toFixed(1)
        : null;

      const roster = rosters.find((r: any) =>
        r.platformUserId === t.externalId || r.platformUserId === t.ownerName
      );

      let rosterBreakdown = '';
      if (roster?.playerData) {
        const players = Array.isArray(roster.playerData) ? roster.playerData : [];
        const enriched = players.map((pid: string) => {
          const player = playerMap.get(pid);
          if (player) {
            return `${player.name} (${player.position || '?'}, ${player.team || '?'}${player.age ? `, age ${player.age}` : ''})`;
          }
          return pid;
        });
        rosterBreakdown = enriched.join(', ');
      }

      return {
        externalId: t.externalId,
        teamName: t.teamName,
        ownerName: t.ownerName,
        record: `${t.wins}-${t.losses}${t.ties > 0 ? `-${t.ties}` : ''}`,
        pointsFor: t.pointsFor,
        pointsAgainst: t.pointsAgainst,
        weeklyScores: weeklyPoints,
        recentAvg,
        seasonAvg,
        aiPowerScore: t.aiPowerScore,
        roster: rosterBreakdown || 'roster data unavailable',
      };
    });

    const targetTeam = teamId
      ? teamsData.find((t: any) => t.externalId === teamId)
      : null;

    const prompt = `You are a dynasty fantasy expert with 20+ years experience. Focus on long-term value, aging curves, and roster construction.

Use ONLY the following provided data. Never hallucinate stats or players not in the data. If roster data is limited, base your analysis on scoring trends and record patterns instead.

LEAGUE CONTEXT:
- Name: ${league.name || 'Unknown'}
- Format: ${league.isDynasty ? 'Dynasty' : 'Redraft'} | ${league.scoring?.toUpperCase() || 'Standard'} | ${league.leagueSize || '?'}-team
- Season: ${league.season || 'Current'}

ALL TEAMS IN LEAGUE:
${teamsData.map((t: any) => `
Team: ${t.teamName} (${t.ownerName})
  Record: ${t.record} | PF: ${t.pointsFor.toFixed(1)} | PA: ${t.pointsAgainst.toFixed(1)}
  Season Avg: ${t.seasonAvg || 'N/A'} | Recent 3-Week Avg: ${t.recentAvg || 'N/A'}
  Weekly Scores: [${t.weeklyScores.join(', ') || 'none'}]
  Current AI Power Score: ${t.aiPowerScore?.toFixed(0) || 'unrated'}
  Roster: ${t.roster}`).join('\n')}

CACHED NFL PLAYER DATABASE (for age/position context):
${cachedPlayers.slice(0, 30).map((p: any) => `${p.name} (${p.position || '?'}, ${p.team || '?'}${p.age ? `, age ${p.age}` : ''}${p.status ? `, ${p.status}` : ''})`).join(', ')}

${targetTeam ? `FOCUS ANALYSIS ON: ${targetTeam.teamName} (${targetTeam.ownerName})` : 'Analyze the league as a whole from a dynasty perspective.'}

Return a JSON object with this exact structure:
{
  "overallOutlook": "2-3 sentence dynasty outlook for ${targetTeam ? targetTeam.teamName : 'this league'}",
  "topAssets": [
    { "name": "player or pick name", "reason": "why this is a top dynasty asset", "dynastyTier": "elite|strong|rising|hold" }
  ],
  "biggestRisks": [
    { "name": "player or situation", "reason": "why this is a dynasty risk", "severity": "critical|moderate|minor" }
  ],
  "projectedRankNext3Years": {
    "year1": { "rank": number, "reasoning": "brief explanation" },
    "year2": { "rank": number, "reasoning": "brief explanation" },
    "year3": { "rank": number, "reasoning": "brief explanation" }
  },
  "contenderOrRebuilder": "contender|fringe|rebuilder",
  "keyRecommendation": "one actionable dynasty move recommendation",
  "confidence": number 0-100
}

Only reference players, stats, and data that appear above. If roster data is unavailable, base analysis on scoring trends and record.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a dynasty fantasy football expert. Only use data provided. Output valid JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return NextResponse.json({
      success: true,
      leagueId,
      teamId: teamId || null,
      leagueName: league.name,
      isDynasty: league.isDynasty ?? false,
      analysis: result,
    });
  } catch (error) {
    console.error('[Dynasty Outlook]', error);
    return NextResponse.json({ error: 'Failed to generate dynasty outlook' }, { status: 500 });
  }
}
