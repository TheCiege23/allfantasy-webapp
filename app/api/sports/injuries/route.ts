import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncAPISportsInjuriesToDb } from '@/lib/api-sports';
import { normalizeTeamAbbrev } from '@/lib/team-abbrev';

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/sports/injuries", tool: "SportsInjuries" })(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get('team');
    const player = searchParams.get('player');
    const refresh = searchParams.get('refresh') === 'true';
    const season = searchParams.get('season');

    if (refresh) {
      await syncAPISportsInjuriesToDb(season || undefined);
    }

    const where: Record<string, unknown> = {
      sport: 'NFL',
      source: 'api_sports',
    };

    if (team) {
      where.team = normalizeTeamAbbrev(team) || team;
    }

    if (player) {
      where.playerName = { contains: player, mode: 'insensitive' };
    }

    const injuries = await prisma.sportsInjury.findMany({
      where,
      orderBy: { fetchedAt: 'desc' },
      take: 200,
    });

    const stale = injuries.length > 0 && injuries[0].expiresAt < new Date();

    if (stale && !refresh) {
      await syncAPISportsInjuriesToDb(season || undefined);
      const freshInjuries = await prisma.sportsInjury.findMany({
        where,
        orderBy: { fetchedAt: 'desc' },
        take: 200,
      });

      return NextResponse.json({
        injuries: freshInjuries,
        count: freshInjuries.length,
        source: 'api_sports',
        refreshed: true,
      });
    }

    return NextResponse.json({
      injuries,
      count: injuries.length,
      source: 'api_sports',
      refreshed: refresh,
    });
  } catch (error) {
    console.error('[Injuries API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch injuries', details: String(error) },
      { status: 500 }
    );
  }
})
