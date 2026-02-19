import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const bodySchema = z.object({
  sleeperUserId: z.string().min(1),
  sport: z.enum(['nfl', 'nba', 'mlb']).default('nfl'),
  season: z.number().int().default(2025),
});

const sportMap: Record<string, 'NFL' | 'NBA' | 'MLB'> = {
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
};

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
    const { sleeperUserId, sport, season } = bodySchema.parse(json);

    const leaguesRes = await fetch(
      `https://api.sleeper.app/v1/user/${sleeperUserId}/leagues/${sport}/${season}`
    );
    if (!leaguesRes.ok) throw new Error('Failed to fetch leagues from Sleeper');
    const leagues = await leaguesRes.json();

    if (!Array.isArray(leagues) || leagues.length === 0) {
      return NextResponse.json({ error: 'No leagues found for this user' }, { status: 404 });
    }

    let imported = 0;

    for (const l of leagues) {
      const platformLeagueId = l.league_id?.toString();
      if (!platformLeagueId) continue;

      const league = await prisma.league.upsert({
        where: {
          userId_platform_platformLeagueId: {
            userId,
            platform: 'sleeper',
            platformLeagueId,
          },
        },
        update: {
          name: l.name || 'Unnamed League',
          avatarUrl: l.avatar ? `https://sleepercdn.com/avatars/${l.avatar}` : null,
          leagueSize: l.total_rosters ?? null,
          status: l.status || 'active',
          season,
          sport: sportMap[sport],
          scoring: l.scoring_settings?.rec === 1 ? 'ppr' : l.scoring_settings?.rec === 0.5 ? 'half-ppr' : 'standard',
          starters: l.roster_positions ?? null,
          rosterSize: l.roster_positions?.length ?? null,
          settings: l.settings ?? null,
        },
        create: {
          userId,
          platform: 'sleeper',
          platformLeagueId,
          name: l.name || 'Unnamed League',
          sport: sportMap[sport],
          season,
          avatarUrl: l.avatar ? `https://sleepercdn.com/avatars/${l.avatar}` : null,
          leagueSize: l.total_rosters ?? null,
          status: l.status || 'active',
          scoring: l.scoring_settings?.rec === 1 ? 'ppr' : l.scoring_settings?.rec === 0.5 ? 'half-ppr' : 'standard',
          starters: l.roster_positions ?? null,
          rosterSize: l.roster_positions?.length ?? null,
          settings: l.settings ?? null,
        },
      });

      const usersRes = await fetch(`https://api.sleeper.app/v1/league/${platformLeagueId}/users`);
      if (!usersRes.ok) continue;
      const users = await usersRes.json();

      const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${platformLeagueId}/rosters`);
      const rosters = rostersRes.ok ? await rostersRes.json() : [];

      const userMap = new Map<string, any>();
      for (const u of users) {
        userMap.set(u.user_id, u);
      }

      for (const roster of rosters) {
        const owner = userMap.get(roster.owner_id);
        const ownerName = owner?.display_name || `Owner ${roster.roster_id}`;
        const teamName = owner?.metadata?.team_name || `${ownerName}'s Team`;
        const externalId = roster.roster_id?.toString() || roster.owner_id?.toString();
        if (!externalId) continue;

        const wins = roster.settings?.wins ?? 0;
        const losses = roster.settings?.losses ?? 0;
        const ties = roster.settings?.ties ?? 0;
        const pointsFor = (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100;
        const pointsAgainst = (roster.settings?.fpts_against ?? 0) + (roster.settings?.fpts_against_decimal ?? 0) / 100;

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
            avatarUrl: owner?.avatar ? `https://sleepercdn.com/avatars/${owner.avatar}` : null,
            wins,
            losses,
            ties,
            pointsFor,
            pointsAgainst,
          },
          create: {
            leagueId: league.id,
            externalId,
            ownerName,
            teamName,
            avatarUrl: owner?.avatar ? `https://sleepercdn.com/avatars/${owner.avatar}` : null,
            wins,
            losses,
            ties,
            pointsFor,
            pointsAgainst,
          },
        });
      }

      imported++;
    }

    return NextResponse.json({ success: true, imported });
  } catch (err: any) {
    console.error('[Import Sleeper]', err);
    return NextResponse.json(
      { error: err.message || 'Import failed' },
      { status: 500 }
    );
  }
}
