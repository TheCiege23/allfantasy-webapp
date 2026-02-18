import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncSleeperLeague } from '@/lib/sleeper-sync';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { sleeperLeagueId } = body;

  if (!sleeperLeagueId) {
    return NextResponse.json({ error: 'Missing Sleeper league ID' }, { status: 400 });
  }

  try {
    const result = await syncSleeperLeague(sleeperLeagueId, userId);

    return NextResponse.json({
      ...result,
      message: `Sleeper league "${result.name}" synced successfully`,
    });
  } catch (error: any) {
    console.error('[Sleeper Sync]', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
