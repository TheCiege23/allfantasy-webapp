import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncLeague } from '@/lib/league-sync-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STALE_HOURS = 24;
const BATCH_SIZE = 50;

function requireCron(req: Request): boolean {
  const provided =
    req.headers.get('x-cron-secret') ?? req.headers.get('x-admin-secret') ?? '';
  const cronSecret = process.env.LEAGUE_CRON_SECRET;
  const adminSecret = process.env.BRACKET_ADMIN_SECRET || process.env.ADMIN_PASSWORD;
  return !!(
    provided &&
    ((cronSecret && provided === cronSecret) ||
      (adminSecret && provided === adminSecret))
  );
}

export async function POST(req: Request) {
  if (!requireCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const leagues = await (prisma as any).league.findMany({
    where: {
      OR: [
        { lastSyncedAt: { lt: staleThreshold } },
        { lastSyncedAt: null },
      ],
      syncStatus: { not: 'error' },
    },
    take: BATCH_SIZE,
    orderBy: { lastSyncedAt: 'asc' },
    select: {
      id: true,
      userId: true,
      platform: true,
      platformLeagueId: true,
      name: true,
    },
  });

  const results: { id: string; name: string; status: string; error?: string }[] = [];

  for (const league of leagues) {
    try {
      await syncLeague(league.userId, league.platform, league.platformLeagueId);
      results.push({ id: league.id, name: league.name, status: 'success' });
    } catch (err: any) {
      console.error(`[Auto-Sync] Failed: ${league.name} (${league.id})`, err.message);

      try {
        await (prisma as any).league.update({
          where: { id: league.id },
          data: {
            syncStatus: 'error',
            syncError: (err.message || 'Auto-sync failed').slice(0, 500),
          },
        });
      } catch {}

      results.push({ id: league.id, name: league.name, status: 'error', error: err.message });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  console.log(`[Auto-Sync] Complete: ${successCount} synced, ${errorCount} failed, ${leagues.length} total`);

  return NextResponse.json({
    success: true,
    total: leagues.length,
    synced: successCount,
    failed: errorCount,
    results,
  });
}
