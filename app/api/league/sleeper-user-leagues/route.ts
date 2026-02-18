import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const profile = await (prisma as any).userProfile.findUnique({
      where: { userId },
      select: { sleeperUsername: true, sleeperUserId: true },
    });

    const sleeperUserId = profile?.sleeperUserId;
    const sleeperUsername = profile?.sleeperUsername;

    if (!sleeperUserId && !sleeperUsername) {
      return NextResponse.json({
        error: 'No Sleeper account linked. Connect your Sleeper username in your profile first.',
        needsLink: true,
      }, { status: 400 });
    }

    const identifier = sleeperUserId || sleeperUsername;

    const searchParams = req.nextUrl.searchParams;
    const season = searchParams.get('season') || String(new Date().getFullYear());
    const sport = searchParams.get('sport') || 'nfl';

    const res = await fetch(
      `https://api.sleeper.app/v1/user/${identifier}/leagues/${sport}/${season}`
    );

    if (!res.ok) {
      const statusText = res.status === 404
        ? 'Sleeper user not found. Check your linked Sleeper username.'
        : `Sleeper API error (${res.status})`;
      return NextResponse.json({ error: statusText }, { status: res.status });
    }

    const leaguesData = await res.json();

    if (!Array.isArray(leaguesData)) {
      return NextResponse.json({ leagues: [] });
    }

    const alreadySynced = await (prisma as any).sleeperLeague.findMany({
      where: { userId },
      select: { sleeperLeagueId: true },
    });
    const syncedIds = new Set(alreadySynced.map((l: any) => l.sleeperLeagueId));

    const leagues = leaguesData.map((lg: any) => {
      const rec = lg.scoring_settings?.rec || 0;
      let scoringType = 'standard';
      if (rec === 1) scoringType = 'ppr';
      else if (rec === 0.5) scoringType = 'half_ppr';

      const rosterPositions = lg.roster_positions || [];
      if (rosterPositions.includes('SUPER_FLEX')) scoringType += '_superflex';

      return {
        sleeperLeagueId: lg.league_id,
        name: lg.name,
        totalTeams: lg.total_rosters || 0,
        season: lg.season,
        status: lg.status,
        isDynasty: lg.settings?.type === 2,
        scoringType,
        avatar: lg.avatar ? `https://sleepercdn.com/avatars/thumbs/${lg.avatar}` : null,
        alreadySynced: syncedIds.has(lg.league_id),
      };
    });

    return NextResponse.json({
      leagues,
      sleeperUsername: sleeperUsername || identifier,
      season,
      total: leagues.length,
    });
  } catch (error: any) {
    console.error('[Sleeper User Leagues]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Sleeper leagues' },
      { status: 500 }
    );
  }
}
