import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const [leagueRes, rostersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${sleeperLeagueId}`),
      fetch(`https://api.sleeper.app/v1/league/${sleeperLeagueId}/rosters`),
    ]);

    if (!leagueRes.ok) throw new Error('League not found or private');
    if (!rostersRes.ok) throw new Error('Failed to fetch rosters');

    const leagueData = await leagueRes.json();
    const rostersData = await rostersRes.json();

    if (!leagueData || !leagueData.name) {
      throw new Error('Invalid league data returned from Sleeper');
    }

    const rec = leagueData.scoring_settings?.rec || 0;
    let scoringType = 'standard';
    if (rec === 1) scoringType = 'ppr';
    else if (rec === 0.5) scoringType = 'half_ppr';

    const rosterPositions = leagueData.roster_positions || [];
    const hasSuperFlex = rosterPositions.includes('SUPER_FLEX');
    if (hasSuperFlex) scoringType += '_superflex';

    const league = await (prisma as any).sleeperLeague.upsert({
      where: { sleeperLeagueId },
      update: {
        name: leagueData.name,
        totalTeams: leagueData.total_rosters || 12,
        season: leagueData.season || String(new Date().getFullYear()),
        status: leagueData.status || 'unknown',
        isDynasty: leagueData.settings?.type === 2,
        scoringType,
        rosterSettings: rosterPositions,
        lastSyncedAt: new Date(),
        syncStatus: 'success',
        syncError: null,
      },
      create: {
        sleeperLeagueId,
        userId,
        name: leagueData.name,
        totalTeams: leagueData.total_rosters || 12,
        season: leagueData.season || String(new Date().getFullYear()),
        status: leagueData.status || 'unknown',
        isDynasty: leagueData.settings?.type === 2,
        scoringType,
        rosterSettings: rosterPositions,
        lastSyncedAt: new Date(),
        syncStatus: 'success',
      },
    });

    let rosterCount = 0;
    for (const roster of rostersData) {
      const rId = String(roster.roster_id);
      const ownerId = roster.owner_id || `unowned_${rId}`;
      const players = Array.isArray(roster.players) ? roster.players : [];
      const starters = Array.isArray(roster.starters) ? roster.starters : [];
      const bench = players.filter((p: string) => !starters.includes(p));

      await (prisma as any).sleeperRoster.upsert({
        where: {
          leagueId_rosterId: { leagueId: league.id, rosterId: rId },
        },
        update: {
          ownerId,
          players,
          starters,
          bench,
          faabRemaining: roster.settings?.waiver_budget_used != null
            ? (leagueData.settings?.waiver_budget || 100) - roster.settings.waiver_budget_used
            : null,
          waiverPriority: roster.settings?.waiver_position ?? null,
          updatedAt: new Date(),
        },
        create: {
          leagueId: league.id,
          ownerId,
          rosterId: rId,
          players,
          starters,
          bench,
          faabRemaining: roster.settings?.waiver_budget_used != null
            ? (leagueData.settings?.waiver_budget || 100) - roster.settings.waiver_budget_used
            : null,
          waiverPriority: roster.settings?.waiver_position ?? null,
        },
      });
      rosterCount++;
    }

    return NextResponse.json({
      success: true,
      leagueId: league.id,
      name: league.name,
      totalTeams: league.totalTeams,
      rostersSync: rosterCount,
      scoringType: league.scoringType,
      isDynasty: league.isDynasty,
      season: league.season,
      message: `Sleeper league "${league.name}" synced successfully`,
    });
  } catch (error: any) {
    console.error('[Sleeper Sync]', error);

    try {
      await (prisma as any).sleeperLeague.update({
        where: { sleeperLeagueId },
        data: {
          syncStatus: 'error',
          syncError: error.message || 'Unknown error',
          lastSyncedAt: new Date(),
        },
      });
    } catch {}

    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
