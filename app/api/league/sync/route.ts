import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit(`league-sync:${ip}`, 5, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { platform, platformLeagueId } = await req.json();

    if (platform !== 'sleeper') {
      return NextResponse.json({ error: 'Only Sleeper supported for now' }, { status: 400 });
    }

    if (!platformLeagueId || typeof platformLeagueId !== 'string') {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    const leagueRes = await fetch(`https://api.sleeper.app/v1/league/${platformLeagueId}`);
    if (!leagueRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch league from Sleeper' }, { status: 502 });
    }
    const leagueData = await leagueRes.json();

    const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${platformLeagueId}/rosters`);
    if (!rostersRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch rosters from Sleeper' }, { status: 502 });
    }
    const rostersData = await rostersRes.json();

    const scoringType = leagueData.scoring_settings?.rec === 1
      ? 'ppr'
      : leagueData.scoring_settings?.rec === 0.5
        ? 'half'
        : 'standard';

    const isDynasty = leagueData.settings?.type === 2;

    const league = await prisma.league.upsert({
      where: { platform_platformLeagueId: { platform: 'sleeper', platformLeagueId } },
      update: {
        name: leagueData.name,
        leagueSize: leagueData.total_rosters || 12,
        scoring: scoringType,
        isDynasty,
        settings: leagueData.settings || {},
        updatedAt: new Date(),
      },
      create: {
        platform: 'sleeper',
        platformLeagueId,
        userId,
        name: leagueData.name,
        leagueSize: leagueData.total_rosters || 12,
        scoring: scoringType,
        isDynasty,
        settings: leagueData.settings || {},
      },
    });

    let rosterCount = 0;
    for (const roster of rostersData) {
      if (!roster.owner_id) continue;
      await prisma.roster.upsert({
        where: {
          leagueId_userId: { leagueId: league.id, userId: roster.owner_id },
        },
        update: {
          playerData: roster.players || [],
          faabRemaining: roster.settings?.waiver_budget_used != null
            ? Math.max(0, 100 - roster.settings.waiver_budget_used)
            : null,
          updatedAt: new Date(),
        },
        create: {
          leagueId: league.id,
          userId: roster.owner_id,
          playerData: roster.players || [],
          faabRemaining: roster.settings?.waiver_budget_used != null
            ? Math.max(0, 100 - roster.settings.waiver_budget_used)
            : null,
        },
      });
      rosterCount++;
    }

    return NextResponse.json({
      success: true,
      leagueId: league.id,
      leagueName: league.name,
      rostersSync: rosterCount,
      scoring: scoringType,
      isDynasty,
    });
  } catch (error: any) {
    console.error('[League Sync]', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
