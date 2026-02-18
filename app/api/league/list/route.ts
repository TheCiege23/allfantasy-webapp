import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [genericLeagues, sleeperLeagues] = await Promise.all([
      (prisma as any).league.findMany({
        where: { userId },
        orderBy: { lastSyncedAt: 'desc' },
        select: {
          id: true,
          name: true,
          platform: true,
          platformLeagueId: true,
          leagueSize: true,
          scoring: true,
          isDynasty: true,
          syncStatus: true,
          syncError: true,
          lastSyncedAt: true,
          createdAt: true,
          rosters: {
            select: {
              id: true,
              platformUserId: true,
              playerData: true,
              faabRemaining: true,
            },
          },
        },
      }),
      (prisma as any).sleeperLeague.findMany({
        where: { userId },
        orderBy: { lastSyncedAt: 'desc' },
        select: {
          id: true,
          name: true,
          sleeperLeagueId: true,
          totalTeams: true,
          season: true,
          status: true,
          isDynasty: true,
          scoringType: true,
          syncStatus: true,
          syncError: true,
          lastSyncedAt: true,
          createdAt: true,
          rosters: {
            select: {
              id: true,
              ownerId: true,
              rosterId: true,
              players: true,
              starters: true,
              bench: true,
              faabRemaining: true,
              waiverPriority: true,
            },
          },
        },
      }),
    ]);

    const normalizedSleeper = sleeperLeagues.map((lg: any) => ({
      id: lg.id,
      name: lg.name,
      platform: 'sleeper',
      platformLeagueId: lg.sleeperLeagueId,
      leagueSize: lg.totalTeams,
      scoring: lg.scoringType,
      isDynasty: lg.isDynasty,
      syncStatus: lg.syncStatus,
      syncError: lg.syncError,
      lastSyncedAt: lg.lastSyncedAt,
      createdAt: lg.createdAt,
      season: lg.season,
      status: lg.status,
      rosters: lg.rosters.map((r: any) => ({
        id: r.id,
        platformUserId: r.ownerId,
        players: r.players,
        starters: r.starters,
        bench: r.bench,
        faabRemaining: r.faabRemaining,
        waiverPriority: r.waiverPriority,
      })),
    }));

    const leagues = [...genericLeagues, ...normalizedSleeper]
      .sort((a: any, b: any) => {
        const aDate = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
        const bDate = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
        return bDate - aDate;
      });

    return NextResponse.json({ leagues });
  } catch (error: any) {
    console.error('[League List]', error);
    return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
  }
}
