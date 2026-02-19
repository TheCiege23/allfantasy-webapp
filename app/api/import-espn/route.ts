import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const bodySchema = z.object({
  leagueId: z.string().min(1),
  season: z.number().int().default(2025),
  espnS2: z.string().optional(),
  swid: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as {
      user?: { id?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;
    const json = await req.json();
    const { leagueId, season, espnS2, swid } = bodySchema.parse(json);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; AllFantasy/1.0)',
    };
    const cookies: string[] = [];
    if (espnS2) cookies.push(`espn_s2=${espnS2}`);
    if (swid) cookies.push(`SWID=${swid}`);
    if (cookies.length > 0) headers['Cookie'] = cookies.join('; ');

    const baseUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`;

    const leagueRes = await fetch(
      `${baseUrl}?view=mTeam&view=mRoster&view=mMatchup&view=mScoreboard&view=mSettings`,
      { headers }
    );

    if (!leagueRes.ok) {
      if (leagueRes.status === 404) {
        return NextResponse.json({ error: 'League not found. Check the League ID.' }, { status: 404 });
      }
      if (leagueRes.status === 401 || leagueRes.status === 403) {
        return NextResponse.json(
          { error: 'This league is private. Please provide your ESPN S2 cookie and SWID.' },
          { status: 401 }
        );
      }
      throw new Error(`ESPN API returned ${leagueRes.status}`);
    }

    const data = await leagueRes.json();

    const leagueName = data.settings?.name || 'ESPN League';
    const leagueSize = data.settings?.size || data.teams?.length || 0;
    const scoringType = data.settings?.scoringSettings?.scoringType;
    let scoring = 'standard';
    if (scoringType === 'H2H_POINTS') scoring = 'h2h-points';
    else if (scoringType === 'H2H_CATEGORY') scoring = 'h2h-category';
    else if (scoringType === 'TOTAL_POINTS') scoring = 'total-points';

    const rosterSlots = data.settings?.rosterSettings?.lineupSlotCounts;

    const league = await prisma.league.upsert({
      where: {
        userId_platform_platformLeagueId: {
          userId,
          platform: 'espn',
          platformLeagueId: leagueId,
        },
      },
      update: {
        name: leagueName,
        leagueSize,
        status: data.status?.currentMatchupPeriod ? 'in_season' : 'active',
        season,
        sport: 'NFL',
        scoring,
        settings: {
          scoringType,
          rosterSlots,
          currentMatchupPeriod: data.status?.currentMatchupPeriod,
        },
      },
      create: {
        userId,
        platform: 'espn',
        platformLeagueId: leagueId,
        name: leagueName,
        sport: 'NFL',
        season,
        leagueSize,
        status: 'active',
        scoring,
        settings: {
          scoringType,
          rosterSlots,
          currentMatchupPeriod: data.status?.currentMatchupPeriod,
        },
      },
    });

    const espnTeams = data.teams || [];

    for (const t of espnTeams) {
      const externalId = t.id?.toString();
      if (!externalId) continue;

      const ownerName = t.owners?.[0]
        ? `${t.owners[0].firstName || ''} ${t.owners[0].lastName || ''}`.trim() || `Owner ${t.id}`
        : `Owner ${t.id}`;
      const teamName = (t.location && t.nickname)
        ? `${t.location} ${t.nickname}`
        : t.name || t.abbrev || `${ownerName}'s Team`;
      const record = t.record?.overall || {};

      await prisma.leagueTeam.upsert({
        where: {
          leagueId_externalId: {
            leagueId: league.id,
            externalId,
          },
        },
        update: {
          ownerName,
          teamName,
          avatarUrl: t.logo || null,
          wins: record.wins ?? 0,
          losses: record.losses ?? 0,
          ties: record.ties ?? 0,
          pointsFor: record.pointsFor ?? t.points ?? 0,
          pointsAgainst: record.pointsAgainst ?? 0,
        },
        create: {
          leagueId: league.id,
          externalId,
          ownerName,
          teamName,
          avatarUrl: t.logo || null,
          wins: record.wins ?? 0,
          losses: record.losses ?? 0,
          ties: record.ties ?? 0,
          pointsFor: record.pointsFor ?? t.points ?? 0,
          pointsAgainst: record.pointsAgainst ?? 0,
        },
      });
    }

    const teamIdMap = new Map<string, string>();
    for (const t of espnTeams) {
      const externalId = t.id?.toString();
      if (!externalId) continue;
      const dbTeam = await prisma.leagueTeam.findUnique({
        where: { leagueId_externalId: { leagueId: league.id, externalId } },
        select: { id: true },
      });
      if (dbTeam) teamIdMap.set(externalId, dbTeam.id);
    }

    const schedule = data.schedule || [];
    for (const matchup of schedule) {
      const week = matchup.matchupPeriodId;
      if (!week || week < 1 || week > 18) continue;

      if (matchup.home) {
        const teamId = teamIdMap.get(matchup.home.teamId?.toString());
        if (teamId && matchup.home.totalPoints != null) {
          await prisma.teamPerformance.upsert({
            where: { teamId_season_week: { teamId, season, week } },
            update: { points: matchup.home.totalPoints || 0 },
            create: { teamId, week, season, points: matchup.home.totalPoints || 0 },
          });
        }
      }

      if (matchup.away) {
        const teamId = teamIdMap.get(matchup.away.teamId?.toString());
        if (teamId && matchup.away.totalPoints != null) {
          await prisma.teamPerformance.upsert({
            where: { teamId_season_week: { teamId, season, week } },
            update: { points: matchup.away.totalPoints || 0 },
            create: { teamId, week, season, points: matchup.away.totalPoints || 0 },
          });
        }
      }
    }

    if (data.scoreboard?.matchups) {
      const currentWeek = data.scoringPeriodId || data.status?.currentMatchupPeriod || 1;
      for (const matchup of data.scoreboard.matchups) {
        for (const side of [matchup.home, matchup.away]) {
          if (!side) continue;
          const teamId = teamIdMap.get(side.teamId?.toString());
          if (teamId && side.totalPoints != null) {
            await (prisma as any).teamPerformance.upsert({
              where: { teamId_season_week: { teamId, season, week: currentWeek } },
              update: { points: side.totalPoints || 0 },
              create: { teamId, week: currentWeek, season, points: side.totalPoints || 0 },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, imported: 1, leagueName });
  } catch (err: any) {
    console.error('[Import ESPN]', err);
    return NextResponse.json(
      { error: err.message || 'ESPN import failed' },
      { status: 500 }
    );
  }
}
