import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as any)?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sleeperUsername } = await req.json().catch(() => ({}));
  if (!sleeperUsername) {
    return NextResponse.json({ error: 'Missing Sleeper username' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.sleeper.app/v1/user/${sleeperUsername}/leagues/nfl/2025`);
    if (!res.ok) throw new Error('Failed to fetch user leagues');

    const leagues = await res.json();

    return NextResponse.json({
      success: true,
      leagues: leagues.map((l: any) => ({
        sleeperLeagueId: l.league_id,
        name: l.name,
        totalTeams: l.total_rosters,
        isDynasty: l.settings?.type === 2,
        season: l.season,
      })),
    });
  } catch (error) {
    console.error('[Sleeper Discover]', error);
    return NextResponse.json({ error: 'Failed to discover leagues' }, { status: 500 });
  }
}
