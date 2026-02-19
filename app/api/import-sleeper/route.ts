import { NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { consumeRateLimit, getClientIp, buildRateLimit429 } from '@/lib/rate-limit';
import { LeagueSport } from '@prisma/client';
import { z } from 'zod';

const limit = pLimit(8);

const bodySchema = z.object({
  sleeperUserId: z.string().min(1).max(100),
  sport: z.enum(['nfl', 'nba', 'mlb']).default('nfl'),
  season: z.number().int().min(2020).max(2030).default(2025),
  isLegacy: z.boolean().default(false),
});

const sportMap: Record<string, LeagueSport> = {
  nfl: LeagueSport.NFL,
  nba: LeagueSport.NBA,
  mlb: LeagueSport.MLB,
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

async function cachedSleeperFetch(url: string, cacheKey: string) {
  const cached = await (prisma as any).sportsDataCache.findUnique({
    where: { key: cacheKey },
  });

  if (cached && new Date(cached.expiresAt) > new Date()) {
    return cached.data;
  }

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  await (prisma as any).sportsDataCache.upsert({
    where: { key: cacheKey },
    update: {
      data,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
    create: {
      key: cacheKey,
      data,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });

  return data;
}

async function processLeague(
  l: any,
  userId: string,
  sport: string,
  season: number,
  sportLabel: LeagueSport,
) {
  const platformLeagueId = l.league_id?.toString();
  if (!platformLeagueId) return null;

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
      sport: sportLabel,
      scoring: l.scoring_settings?.rec === 1 ? 'ppr' : l.scoring_settings?.rec === 0.5 ? 'half-ppr' : 'standard',
      isDynasty: l.settings?.type === 2,
      starters: l.roster_positions ?? null,
      rosterSize: l.roster_positions?.length ?? null,
      settings: l.settings ?? null,
    },
    create: {
      userId,
      platform: 'sleeper',
      platformLeagueId,
      name: l.name || 'Unnamed League',
      sport: sportLabel,
      season,
      avatarUrl: l.avatar ? `https://sleepercdn.com/avatars/${l.avatar}` : null,
      leagueSize: l.total_rosters ?? null,
      status: l.status || 'active',
      scoring: l.scoring_settings?.rec === 1 ? 'ppr' : l.scoring_settings?.rec === 0.5 ? 'half-ppr' : 'standard',
      isDynasty: l.settings?.type === 2,
      starters: l.roster_positions ?? null,
      rosterSize: l.roster_positions?.length ?? null,
      settings: l.settings ?? null,
    },
  });

  await (prisma as any).sportsDataCache.upsert({
    where: { key: `sleeper:league:${platformLeagueId}` },
    update: {
      data: l,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
    create: {
      key: `sleeper:league:${platformLeagueId}`,
      data: l,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });

  const [users, rosters] = await Promise.all([
    cachedSleeperFetch(
      `https://api.sleeper.app/v1/league/${platformLeagueId}/users`,
      `sleeper:users:${platformLeagueId}`
    ),
    cachedSleeperFetch(
      `https://api.sleeper.app/v1/league/${platformLeagueId}/rosters`,
      `sleeper:rosters:${platformLeagueId}`
    ),
  ]);

  if (!Array.isArray(users) || !Array.isArray(rosters)) return league.id;

  const userMap = new Map<string, any>();
  for (const u of users) {
    userMap.set(u.user_id, u);
  }

  const teamUpserts = rosters.map((roster: any) => {
    const owner = userMap.get(roster.owner_id);
    const ownerName = owner?.display_name || `Owner ${roster.roster_id}`;
    const teamName = owner?.metadata?.team_name || `${ownerName}'s Team`;
    const externalId = roster.roster_id?.toString() || roster.owner_id?.toString();
    if (!externalId) return null;

    const wins = roster.settings?.wins ?? 0;
    const losses = roster.settings?.losses ?? 0;
    const ties = roster.settings?.ties ?? 0;
    const pointsFor = (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100;
    const pointsAgainst = (roster.settings?.fpts_against ?? 0) + (roster.settings?.fpts_against_decimal ?? 0) / 100;

    return prisma.leagueTeam.upsert({
      where: {
        leagueId_externalId: { leagueId: league.id, externalId },
      },
      update: {
        ownerName,
        teamName,
        avatarUrl: owner?.metadata?.avatar || `https://sleepercdn.com/avatars/${owner?.user_id || roster.owner_id}`,
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
        avatarUrl: owner?.metadata?.avatar || `https://sleepercdn.com/avatars/${owner?.user_id || roster.owner_id}`,
        wins,
        losses,
        ties,
        pointsFor,
        pointsAgainst,
      },
    });
  }).filter(Boolean);

  await Promise.all(teamUpserts);

  const teams = await prisma.leagueTeam.findMany({
    where: { leagueId: league.id },
    select: { id: true, externalId: true },
  });
  const teamsByExternalId = new Map(teams.map((t) => [t.externalId, t.id]));

  const currentWeek = l.settings?.leg ?? 10;
  const maxWeek = Math.min(currentWeek, 18);

  const weekLimit = pLimit(4);
  await Promise.all(
    Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) =>
      weekLimit(async () => {
        try {
          const matchups = await cachedSleeperFetch(
            `https://api.sleeper.app/v1/league/${platformLeagueId}/matchups/${week}`,
            `sleeper:matchup:${platformLeagueId}:w${week}`
          );
          if (!Array.isArray(matchups)) return;

          for (const m of matchups) {
            const teamId = teamsByExternalId.get(m.roster_id?.toString());
            if (!teamId || m.points == null) continue;

            await prisma.teamPerformance.upsert({
              where: { teamId_season_week: { teamId, season, week } },
              update: { points: m.points || 0 },
              create: { teamId, week, season, points: m.points || 0 },
            });
          }
        } catch {
          // skip failed weeks
        }
      })
    )
  );

  return league.id;
}

export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as {
      user?: { id?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;
    const ip = getClientIp(req);

    const rl = consumeRateLimit({
      scope: 'import',
      action: 'sleeper_sync',
      ip,
      maxRequests: 5,
      windowMs: 60 * 1000,
    });

    if (!rl.success) {
      return NextResponse.json(buildRateLimit429({ rl }), { status: 429 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { sleeperUserId, sport, season, isLegacy } = parsed.data;
    const sportLabel = sportMap[sport];

    const leaguesData = await cachedSleeperFetch(
      `https://api.sleeper.app/v1/user/${sleeperUserId}/leagues/${sport}/${season}`,
      `sleeper:user_leagues:${sleeperUserId}:${season}`
    );

    if (!Array.isArray(leaguesData) || leaguesData.length === 0) {
      return NextResponse.json({ error: 'No leagues found for this user' }, { status: 404 });
    }

    const results = await Promise.all(
      leaguesData.map((l: any) =>
        limit(() => processLeague(l, userId, sport, season, sportLabel).catch((err) => {
          console.error(`[Import Sleeper] Failed league ${l.league_id}:`, err.message);
          return null;
        }))
      )
    );

    const imported = results.filter(Boolean).length;
    const failed = results.filter((r) => r === null).length;

    return NextResponse.json({
      success: true,
      imported,
      failed,
      total: leaguesData.length,
      isLegacy,
    });
  } catch (err: any) {
    console.error('[Import Sleeper]', err);
    return NextResponse.json(
      { error: err.message || 'Import failed' },
      { status: 500 }
    );
  }
}
