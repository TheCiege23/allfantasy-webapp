import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncNFLTeamStatsToDb } from '@/lib/rolling-insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const team = url.searchParams.get('team');
  const season = url.searchParams.get('season');
  const seasonType = url.searchParams.get('seasonType') || 'regular';
  const refresh = url.searchParams.get('refresh') === 'true';

  try {
    if (refresh) {
      await syncNFLTeamStatsToDb();
    }

    const where: Record<string, unknown> = {
      sport: 'NFL',
      seasonType,
    };
    if (team) where.team = team.toUpperCase();
    if (season) where.season = season;

    const stats = await prisma.teamSeasonStats.findMany({
      where,
      orderBy: [{ team: 'asc' }, { season: 'desc' }],
    });

    const stale = stats.length === 0 || (stats.length > 0 && stats[0].expiresAt < new Date());

    if (stale && !refresh) {
      await syncNFLTeamStatsToDb();
      const refreshed = await prisma.teamSeasonStats.findMany({
        where,
        orderBy: [{ team: 'asc' }, { season: 'desc' }],
      });
      return NextResponse.json({ stats: refreshed, synced: true });
    }

    return NextResponse.json({ stats, synced: refresh });
  } catch (error: any) {
    console.error('[team-stats] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
