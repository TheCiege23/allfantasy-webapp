import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEnrichedTrendingPlayers, type TrendingPlayerEnriched } from '@/lib/sleeper-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRENDING_TTL_MS = 2 * 60 * 60 * 1000;

async function syncTrendingPlayersToDb(
  sport: string = 'nfl',
  lookbackHours: number = 24,
): Promise<number> {
  let enriched: TrendingPlayerEnriched[];
  try {
    enriched = await getEnrichedTrendingPlayers(sport, lookbackHours);
  } catch (error) {
    console.error('[Trending] Failed to fetch trending players:', error);
    return 0;
  }

  if (!enriched.length) return 0;

  const expiresAt = new Date(Date.now() + TRENDING_TTL_MS);
  let synced = 0;

  for (const p of enriched) {
    try {
      await prisma.trendingPlayer.upsert({
        where: {
          sport_sleeperId_lookbackHours: {
            sport,
            sleeperId: p.sleeperId,
            lookbackHours,
          },
        },
        update: {
          playerName: p.name,
          position: p.position,
          team: p.team,
          addCount: p.addCount,
          dropCount: p.dropCount,
          netTrend: p.netTrend,
          addRank: p.addRank,
          dropRank: p.dropRank,
          crowdSignal: p.crowdSignal,
          crowdScore: p.crowdScore,
          fetchedAt: p.fetchedAt,
          expiresAt,
        },
        create: {
          sport,
          sleeperId: p.sleeperId,
          playerName: p.name,
          position: p.position,
          team: p.team,
          addCount: p.addCount,
          dropCount: p.dropCount,
          netTrend: p.netTrend,
          addRank: p.addRank,
          dropRank: p.dropRank,
          crowdSignal: p.crowdSignal,
          crowdScore: p.crowdScore,
          lookbackHours,
          fetchedAt: p.fetchedAt,
          expiresAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[Trending] Failed to upsert ${p.sleeperId}:`, err);
    }
  }

  console.log(`[Trending] Synced ${synced} trending players (${sport}, ${lookbackHours}h lookback)`);
  return synced;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sport = url.searchParams.get('sport') || 'nfl';
  const signal = url.searchParams.get('signal');
  const position = url.searchParams.get('position');
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
  const refresh = url.searchParams.get('refresh') === 'true';

  try {
    if (refresh) {
      await syncTrendingPlayersToDb(sport);
    }

    const where: Record<string, unknown> = { sport };
    if (signal) where.crowdSignal = signal;
    if (position) where.position = position.toUpperCase();

    const players = await prisma.trendingPlayer.findMany({
      where,
      orderBy: { crowdScore: 'desc' },
      take: limit,
    });

    const stale = players.length === 0 || players[0].expiresAt < new Date();

    if (stale && !refresh) {
      await syncTrendingPlayersToDb(sport);
      const refreshed = await prisma.trendingPlayer.findMany({
        where,
        orderBy: { crowdScore: 'desc' },
        take: limit,
      });
      return NextResponse.json({
        players: refreshed,
        synced: true,
        count: refreshed.length,
      });
    }

    return NextResponse.json({
      players,
      synced: refresh,
      count: players.length,
    });
  } catch (error: any) {
    console.error('[trending] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
