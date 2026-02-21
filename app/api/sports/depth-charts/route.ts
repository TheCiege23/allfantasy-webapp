import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncNFLDepthChartsToDb } from '@/lib/rolling-insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const team = url.searchParams.get('team');
  const position = url.searchParams.get('position');
  const refresh = url.searchParams.get('refresh') === 'true';

  try {
    if (refresh) {
      await syncNFLDepthChartsToDb();
    }

    const where: Record<string, unknown> = { sport: 'NFL' };
    if (team) where.team = team.toUpperCase();
    if (position) where.position = position.toUpperCase();

    const charts = await prisma.depthChart.findMany({
      where,
      orderBy: [{ team: 'asc' }, { position: 'asc' }],
    });

    const stale = charts.length === 0 || (charts.length > 0 && charts[0].expiresAt < new Date());

    if (stale && !refresh) {
      await syncNFLDepthChartsToDb();
      const refreshed = await prisma.depthChart.findMany({
        where,
        orderBy: [{ team: 'asc' }, { position: 'asc' }],
      });
      return NextResponse.json({ charts: refreshed, synced: true });
    }

    return NextResponse.json({ charts, synced: refresh });
  } catch (error: any) {
    console.error('[depth-charts] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
