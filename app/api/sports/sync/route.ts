import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { syncNFLTeamsToDb, syncNFLPlayersToDb, syncNFLScheduleToDb } from '@/lib/rolling-insights';
import {
  syncAPISportsTeamsToDb,
  syncAPISportsGamesToDb,
  syncAPISportsInjuriesToDb,
  syncAPISportsPlayersToIdentityMap,
  syncAPISportsStandingsToDb,
} from '@/lib/api-sports';

export const POST = withApiUsage({ endpoint: "/api/sports/sync", tool: "SportsSync" })(async (request: NextRequest) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const authHeader = request.headers.get('authorization');

  if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const syncType = (body as Record<string, string>).type || 'all';
    const season = (body as Record<string, string>).season;
    const source = (body as Record<string, string>).source || 'all';

    const results: Record<string, unknown> = {};
    const startTime = Date.now();

    if (source === 'all' || source === 'rolling_insights') {
      if (syncType === 'all' || syncType === 'teams') {
        const teamCount = await syncNFLTeamsToDb();
        results.ri_teams = { synced: teamCount };
      }

      if (syncType === 'all' || syncType === 'schedule') {
        const gameCount = await syncNFLScheduleToDb({ season });
        results.ri_schedule = { synced: gameCount };
      }

      if (syncType === 'all' || syncType === 'players') {
        const playerCount = await syncNFLPlayersToDb({ season });
        results.ri_players = { synced: playerCount };
      }
    }

    if (source === 'all' || source === 'api_sports') {
      if (syncType === 'all' || syncType === 'teams') {
        const teamCount = await syncAPISportsTeamsToDb();
        results.as_teams = { synced: teamCount };
      }

      if (syncType === 'all' || syncType === 'schedule' || syncType === 'games') {
        const gameCount = await syncAPISportsGamesToDb(season);
        results.as_games = { synced: gameCount };
      }

      if (syncType === 'all' || syncType === 'injuries') {
        const injuryCount = await syncAPISportsInjuriesToDb(season);
        results.as_injuries = { synced: injuryCount };
      }

      if (syncType === 'all' || syncType === 'standings') {
        const standingsCount = await syncAPISportsStandingsToDb(season);
        results.as_standings = { synced: standingsCount };
      }

      if (syncType === 'all' || syncType === 'identity') {
        const identityResult = await syncAPISportsPlayersToIdentityMap(season);
        results.as_identity = identityResult;
      }
    }

    if (source === 'all' || source === 'espn') {
      if (syncType === 'all' || syncType === 'news') {
        const { syncFullNewsCoverage } = await import('@/app/api/sports/news/sync-helper');
        const newsResult = await syncFullNewsCoverage();
        results.news = { synced: newsResult.total, breakdown: newsResult.breakdown };
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      syncType,
      source,
      season: season || 'current',
      results,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SportsSync] Error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
})

export const GET = withApiUsage({ endpoint: "/api/sports/sync", tool: "SportsSync" })(async (request: NextRequest) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const authHeader = request.headers.get('authorization');

  if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { prisma } = await import('@/lib/prisma');

    const [
      riTeams, riPlayers, riGames, riStats,
      asTeams, asGames, asInjuries,
      espnLiveGames, espnNews,
      cacheCount, identityCount, identityWithApiSports,
    ] = await Promise.all([
      prisma.sportsTeam.count({ where: { source: 'rolling_insights' } }),
      prisma.sportsPlayer.count({ where: { source: 'rolling_insights' } }),
      prisma.sportsGame.count({ where: { source: 'rolling_insights' } }),
      prisma.playerSeasonStats.count({ where: { source: 'rolling_insights' } }),
      prisma.sportsTeam.count({ where: { source: 'api_sports' } }),
      prisma.sportsGame.count({ where: { source: 'api_sports' } }),
      prisma.sportsInjury.count({ where: { source: 'api_sports' } }),
      prisma.sportsGame.count({ where: { source: 'espn_live' } }),
      prisma.sportsNews.count({ where: { source: 'espn' } }),
      prisma.sportsDataCache.count(),
      prisma.playerIdentityMap.count(),
      prisma.playerIdentityMap.count({ where: { apiSportsId: { not: null } } }),
    ]);

    const latestRISync = await prisma.sportsPlayer.findFirst({
      where: { source: 'rolling_insights' },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    });

    const latestASSync = await prisma.sportsInjury.findFirst({
      where: { source: 'api_sports' },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    });

    const latestLiveScore = await prisma.sportsGame.findFirst({
      where: { source: 'espn_live' },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    });

    const latestNewsSync = await prisma.sportsNews.findFirst({
      where: { source: 'espn' },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    });

    return NextResponse.json({
      success: true,
      status: {
        rolling_insights: {
          teams: riTeams,
          players: riPlayers,
          games: riGames,
          seasonStats: riStats,
          lastSyncAt: latestRISync?.fetchedAt?.toISOString() || null,
        },
        api_sports: {
          teams: asTeams,
          games: asGames,
          injuries: asInjuries,
          standings: await prisma.sportsDataCache.count({ where: { key: { startsWith: 'NFL:standings:' } } }),
          lastSyncAt: latestASSync?.fetchedAt?.toISOString() || null,
        },
        espn: {
          liveGames: espnLiveGames,
          news: espnNews,
          lastLiveScoreSync: latestLiveScore?.fetchedAt?.toISOString() || null,
          lastNewsSync: latestNewsSync?.fetchedAt?.toISOString() || null,
        },
        identity: {
          totalPlayers: identityCount,
          withApiSportsId: identityWithApiSports,
        },
        cacheEntries: cacheCount,
      },
    });
  } catch (error) {
    console.error('[SportsSync] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: String(error) },
      { status: 500 }
    );
  }
})
