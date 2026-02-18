import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

function detectScoring(leagueData: any): string {
  const rec = leagueData.scoring_settings?.rec;
  if (rec === 1) return 'ppr';
  if (rec === 0.5) return 'half';
  return 'standard';
}

function detectDynasty(leagueData: any): boolean {
  return leagueData.settings?.type === 2 || leagueData.settings?.type === 'dynasty';
}

async function fetchSleeperLeague(platformLeagueId: string) {
  const [leagueRes, rostersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${platformLeagueId}`),
    fetch(`https://api.sleeper.app/v1/league/${platformLeagueId}/rosters`),
  ]);

  if (!leagueRes.ok) throw new Error('Failed to fetch league from Sleeper');
  if (!rostersRes.ok) throw new Error('Failed to fetch rosters from Sleeper');

  const leagueData = await leagueRes.json();
  const rostersData = await rostersRes.json();

  return {
    name: leagueData.name || 'Unknown League',
    leagueSize: leagueData.total_rosters || 12,
    scoring: detectScoring(leagueData),
    isDynasty: detectDynasty(leagueData),
    settings: leagueData.settings || {},
    rosters: (Array.isArray(rostersData) ? rostersData : [])
      .filter((r: any) => !!r.owner_id)
      .map((r: any) => ({
        platformUserId: r.owner_id,
        playerData: r.players || [],
        faabRemaining: r.settings?.waiver_budget_used != null
          ? Math.max(0, 100 - r.settings.waiver_budget_used)
          : null,
      })),
  };
}

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

    const { platform, platformLeagueId, authToken } = await req.json();

    if (!platform || !platformLeagueId) {
      return NextResponse.json({ error: 'Missing required fields: platform and platformLeagueId' }, { status: 400 });
    }

    let leaguePayload: Awaited<ReturnType<typeof fetchSleeperLeague>>;

    switch (platform.toLowerCase()) {
      case 'sleeper':
        leaguePayload = await fetchSleeperLeague(platformLeagueId);
        break;

      case 'mfl':
        if (!authToken) {
          return NextResponse.json({ error: 'MFL requires an authToken (API key)' }, { status: 400 });
        }
        return NextResponse.json({ error: 'MFL sync coming soon' }, { status: 501 });

      case 'yahoo':
        return NextResponse.json({ error: 'Yahoo requires OAuth2. Coming soon.' }, { status: 501 });

      case 'espn':
        return NextResponse.json({ error: 'ESPN sync requires private cookies (SWID + ESPN_S2). Coming soon.' }, { status: 501 });

      case 'fantrax':
        return NextResponse.json({ error: 'Fantrax sync coming soon' }, { status: 501 });

      default:
        return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
    }

    const normalizedPlatform = platform.toLowerCase();

    const league = await (prisma as any).league.upsert({
      where: {
        userId_platform_platformLeagueId: {
          userId,
          platform: normalizedPlatform,
          platformLeagueId,
        },
      },
      update: {
        name: leaguePayload.name,
        leagueSize: leaguePayload.leagueSize,
        scoring: leaguePayload.scoring,
        isDynasty: leaguePayload.isDynasty,
        settings: leaguePayload.settings,
        lastSyncedAt: new Date(),
        syncStatus: 'success',
        syncError: null,
        updatedAt: new Date(),
      },
      create: {
        platform: normalizedPlatform,
        platformLeagueId,
        userId,
        name: leaguePayload.name,
        leagueSize: leaguePayload.leagueSize,
        scoring: leaguePayload.scoring,
        isDynasty: leaguePayload.isDynasty,
        settings: leaguePayload.settings,
        lastSyncedAt: new Date(),
        syncStatus: 'success',
      },
    });

    let rosterCount = 0;
    for (const roster of leaguePayload.rosters) {
      await (prisma as any).roster.upsert({
        where: {
          leagueId_platformUserId: { leagueId: league.id, platformUserId: roster.platformUserId },
        },
        update: {
          playerData: roster.playerData,
          faabRemaining: roster.faabRemaining,
          updatedAt: new Date(),
        },
        create: {
          leagueId: league.id,
          platformUserId: roster.platformUserId,
          playerData: roster.playerData,
          faabRemaining: roster.faabRemaining,
        },
      });
      rosterCount++;
    }

    return NextResponse.json({
      success: true,
      leagueId: league.id,
      leagueName: league.name,
      platform: normalizedPlatform,
      rostersSync: rosterCount,
      scoring: leaguePayload.scoring,
      isDynasty: leaguePayload.isDynasty,
      lastSyncedAt: league.lastSyncedAt,
    });
  } catch (error: any) {
    console.error('[League Sync]', error);

    try {
      await (prisma as any).league.updateMany({
        where: { userId, syncStatus: 'pending' },
        data: {
          syncStatus: 'error',
          syncError: (error.message || 'Unknown error').slice(0, 500),
        },
      });
    } catch {}

    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
