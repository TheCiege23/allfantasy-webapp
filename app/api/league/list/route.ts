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

    const leagues = await (prisma as any).league.findMany({
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
      },
    });

    return NextResponse.json({ leagues });
  } catch (error: any) {
    console.error('[League List]', error);
    return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
  }
}
