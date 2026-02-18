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

  const leagueId = req.nextUrl.searchParams.get('leagueId');
  if (!leagueId) {
    return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
  }

  const sleeperLeague = await (prisma as any).sleeperLeague.findFirst({
    where: { id: leagueId, userId },
    select: {
      id: true,
      name: true,
      scoringType: true,
      isDynasty: true,
      totalTeams: true,
      rosterSettings: true,
    },
  });

  if (sleeperLeague) {
    const profile = await (prisma as any).userProfile.findUnique({
      where: { userId },
      select: { sleeperUserId: true },
    });

    if (!profile?.sleeperUserId) {
      return NextResponse.json({
        league: { ...sleeperLeague, platform: 'sleeper' },
        roster: null,
        players: [],
        faabRemaining: null,
        message: 'Link your Sleeper account in your profile to auto-load your roster',
      });
    }

    const roster = await (prisma as any).sleeperRoster.findFirst({
      where: {
        leagueId: sleeperLeague.id,
        ownerId: profile.sleeperUserId,
      },
    });

    if (!roster) {
      return NextResponse.json({
        league: { ...sleeperLeague, platform: 'sleeper' },
        roster: null,
        players: [],
        faabRemaining: null,
        message: 'Your roster was not found in this league. Check your Sleeper user ID.',
      });
    }

    let playerNameMap: Record<string, string> = {};
    const allPlayerIds = [...(roster.starters || []), ...(roster.bench || [])];
    if (allPlayerIds.length > 0) {
      const dbPlayers = await (prisma as any).playerAnalytics.findMany({
        where: { playerId: { in: allPlayerIds } },
        select: { playerId: true, playerName: true, position: true },
      }).catch(() => []);
      for (const p of dbPlayers) {
        playerNameMap[p.playerId] = p.playerName;
      }
    }

    const players = (roster.starters || []).map((pid: string, i: number) => ({
      id: pid,
      name: playerNameMap[pid] || pid,
      position: (sleeperLeague.rosterSettings || [])[i] || 'FLEX',
      isStarter: true,
    })).concat(
      (roster.bench || []).map((pid: string) => ({
        id: pid,
        name: playerNameMap[pid] || pid,
        position: 'BN',
        isStarter: false,
      }))
    );

    return NextResponse.json({
      league: { ...sleeperLeague, platform: 'sleeper' },
      roster: { id: roster.id, ownerId: roster.ownerId },
      players,
      faabRemaining: roster.faabRemaining,
      waiverPriority: roster.waiverPriority,
    });
  }

  const genericLeague = await (prisma as any).league.findFirst({
    where: { id: leagueId, userId },
    include: {
      rosters: {
        where: { platformUserId: userId },
        take: 1,
        select: {
          id: true,
          platformUserId: true,
          playerData: true,
          faabRemaining: true,
        },
      },
    },
  });

  if (!genericLeague) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  const genRoster = genericLeague.rosters?.[0];
  if (!genRoster) {
    return NextResponse.json({
      league: {
        id: genericLeague.id,
        name: genericLeague.name,
        scoringType: genericLeague.scoring,
        isDynasty: genericLeague.isDynasty,
        totalTeams: genericLeague.leagueSize,
        platform: genericLeague.platform,
      },
      roster: null,
      players: [],
      faabRemaining: null,
      message: 'Your roster was not found in this league',
    });
  }

  const playerData = genRoster.playerData || [];

  return NextResponse.json({
    league: {
      id: genericLeague.id,
      name: genericLeague.name,
      scoringType: genericLeague.scoring,
      isDynasty: genericLeague.isDynasty,
      totalTeams: genericLeague.leagueSize,
      platform: genericLeague.platform,
    },
    roster: { id: genRoster.id, ownerId: genRoster.platformUserId },
    players: Array.isArray(playerData)
      ? playerData.map((p: any) => ({
          id: p.id || p.name,
          name: p.name || p.id,
          position: p.position || 'FLEX',
          isStarter: p.isStarter ?? true,
        }))
      : [],
    faabRemaining: genRoster.faabRemaining || null,
  });
}
