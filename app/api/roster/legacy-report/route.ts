import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
type InsightResult = {
  title: string;
  description: string;
  score: number;
  iconName: string;
  color: string;
  recommendation?: string;
};

async function getPlayerDataByNames(playerNames: string[]) {
  if (playerNames.length === 0) return [];
  const normalized = playerNames.map((n: string) => n.toLowerCase().replace(/[^a-z]/g, ''));
  const players = await (prisma as any).playerAnalyticsSnapshot.findMany({
    where: {
      normalizedName: { in: normalized },
    },
    select: {
      name: true,
      normalizedName: true,
      position: true,
      status: true,
      currentTeam: true,
      draftYear: true,
      draftPick: true,
      currentAdp: true,
      totalFantasyPoints: true,
      fantasyPointsPerGame: true,
      weeklyVolatility: true,
      breakoutAge: true,
      lifetimeValue: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  return players;
}

function extractPlayerNames(playerData: any): string[] {
  if (Array.isArray(playerData)) {
    return playerData
      .map((p: any) => (typeof p === 'string' ? p : p?.name || p?.playerName || ''))
      .filter(Boolean);
  }
  if (typeof playerData === 'object' && playerData !== null) {
    return Object.values(playerData)
      .map((p: any) => (typeof p === 'string' ? p : (p as any)?.name || (p as any)?.playerName || ''))
      .filter(Boolean);
  }
  return [];
}

function computeCategories(
  roster: any,
  playerData: any[],
  leagueInfo: { isDynasty: boolean; scoring: string; totalTeams: number }
) {
  const players = playerData;
  const starters = roster.starters || [];
  const bench = roster.bench || [];
  const allPlayers = [...starters, ...bench];
  const positionCounts: Record<string, number> = {};
  for (const p of players) {
    positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
  }

  const avgFppg = players.length > 0
    ? players.reduce((s: number, p: any) => s + (p.fantasyPointsPerGame || 0), 0) / players.length
    : 0;

  const avgAdp = players.filter((p: any) => p.currentAdp).length > 0
    ? players.filter((p: any) => p.currentAdp).reduce((s: number, p: any) => s + p.currentAdp, 0) /
      players.filter((p: any) => p.currentAdp).length
    : 999;

  const youngPlayers = players.filter((p: any) => p.draftYear && p.draftYear >= new Date().getFullYear() - 3);
  const veteranPlayers = players.filter((p: any) => p.draftYear && p.draftYear < new Date().getFullYear() - 6);

  const avgVolatility = players.filter((p: any) => p.weeklyVolatility).length > 0
    ? players.filter((p: any) => p.weeklyVolatility).reduce((s: number, p: any) => s + p.weeklyVolatility, 0) /
      players.filter((p: any) => p.weeklyVolatility).length
    : 50;

  const insights: InsightResult[] = [];

  const starterScore = Math.min(100, Math.round(
    (avgFppg / 15) * 50 + (starters.length >= 8 ? 30 : starters.length * 3.75) + (avgAdp < 100 ? 20 : avgAdp < 200 ? 10 : 0)
  ));
  insights.push({
    title: 'Starter Power',
    description: `Your starters average ${avgFppg.toFixed(1)} PPG across ${starters.length} slots. ${starterScore >= 75 ? 'Elite ceiling.' : starterScore >= 50 ? 'Solid foundation.' : 'Needs upgrades.'}`,
    score: starterScore,
    iconName: 'TrendingUp',
    color: 'text-cyan-400',
    recommendation: starterScore < 60 ? 'Target a top-tier starter upgrade at your weakest position.' : undefined,
  });

  const depthTotal = allPlayers.length;
  const depthScore = Math.min(100, Math.round(
    (depthTotal >= 20 ? 40 : depthTotal * 2) +
    (bench.length >= 8 ? 30 : bench.length * 3.75) +
    (Object.keys(positionCounts).length >= 4 ? 30 : Object.keys(positionCounts).length * 7.5)
  ));
  insights.push({
    title: 'Roster Depth',
    description: `${depthTotal} total players with ${bench.length} bench spots across ${Object.keys(positionCounts).length} positions. ${depthScore >= 70 ? 'Well-stocked.' : 'Thin in spots.'}`,
    score: depthScore,
    iconName: 'Users',
    color: 'text-indigo-400',
    recommendation: depthScore < 60 ? 'Add depth via waivers at your thinnest position group.' : undefined,
  });

  const youthRatio = players.length > 0 ? youngPlayers.length / players.length : 0;
  const dynastyScore = leagueInfo.isDynasty
    ? Math.min(100, Math.round(youthRatio * 60 + (youngPlayers.length >= 5 ? 40 : youngPlayers.length * 8)))
    : Math.min(100, Math.round(50 + (avgFppg / 15) * 30 + (starterScore >= 70 ? 20 : 0)));
  insights.push({
    title: leagueInfo.isDynasty ? 'Dynasty Outlook' : 'Win-Now Grade',
    description: leagueInfo.isDynasty
      ? `${youngPlayers.length} young assets (${Math.round(youthRatio * 100)}% of roster). ${dynastyScore >= 75 ? 'Strong long-term build.' : 'Consider investing in youth.'}`
      : `${starterScore >= 70 ? 'Championship-caliber starters.' : 'Mid-tier competitor.'} ${avgFppg.toFixed(1)} avg PPG.`,
    score: dynastyScore,
    iconName: leagueInfo.isDynasty ? 'Clock' : 'Award',
    color: leagueInfo.isDynasty ? 'text-purple-400' : 'text-yellow-400',
    recommendation: leagueInfo.isDynasty && dynastyScore < 60 ? 'Trade aging veterans for young upside players and draft picks.' : undefined,
  });

  const consistencyScore = Math.min(100, Math.round(
    100 - (avgVolatility * 5) + (veteranPlayers.length >= 3 ? 15 : 0)
  ));
  insights.push({
    title: 'Consistency',
    description: `Avg weekly volatility: ${avgVolatility.toFixed(1)}. ${consistencyScore >= 70 ? 'Reliable week-to-week.' : 'Boom-or-bust tendencies.'}`,
    score: Math.max(0, Math.min(100, consistencyScore)),
    iconName: 'Shield',
    color: 'text-emerald-400',
    recommendation: consistencyScore < 50 ? 'Swap volatile bench pieces for consistent floor players.' : undefined,
  });

  const faab = roster.faabRemaining;
  const budgetScore = faab != null
    ? Math.min(100, Math.round(faab >= 80 ? 90 : faab >= 50 ? 70 : faab >= 20 ? 50 : 25))
    : 50;
  insights.push({
    title: 'FAAB Strategy',
    description: faab != null
      ? `$${faab} FAAB remaining. ${budgetScore >= 70 ? 'Plenty of ammo for pickups.' : budgetScore >= 40 ? 'Moderate budget left.' : 'Running low on budget.'}`
      : 'No FAAB data available. Sync your league for budget tracking.',
    score: budgetScore,
    iconName: 'DollarSign',
    color: 'text-amber-400',
    recommendation: budgetScore < 40 ? 'Be selective with remaining FAAB — save for emergency pickups.' : undefined,
  });

  const injuredCount = players.filter((p: any) => p.status && !['Active', 'active', null].includes(p.status)).length;
  const healthScore = players.length > 0
    ? Math.min(100, Math.round(100 - (injuredCount / players.length) * 100))
    : 50;
  insights.push({
    title: 'Roster Health',
    description: `${injuredCount} player${injuredCount !== 1 ? 's' : ''} with non-active status. ${healthScore >= 80 ? 'Clean bill of health.' : healthScore >= 50 ? 'Some concerns.' : 'Significant injury risk.'}`,
    score: healthScore,
    iconName: 'AlertTriangle',
    color: 'text-red-400',
    recommendation: healthScore < 50 ? 'Monitor injury reports closely and roster handcuffs.' : undefined,
  });

  const overallScore = Math.round(
    insights.reduce((sum, i) => sum + i.score, 0) / insights.length
  );

  return { insights, overallScore };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let { leagueId } = body;

    if (!leagueId) {
      const user = await (prisma as any).appUser.findUnique({
        where: { id: userId },
        select: { activeLeagueId: true },
      });
      leagueId = user?.activeLeagueId;
    }

    if (!leagueId) {
      return NextResponse.json(
        { error: 'No league specified. Sync a league first or set an active league.' },
        { status: 400 }
      );
    }

    let rosterData: any = null;
    let leagueInfo = { isDynasty: false, scoring: 'ppr', totalTeams: 12 };

    const sleeperLeague = await (prisma as any).sleeperLeague.findFirst({
      where: { id: leagueId, userId },
    });

    if (sleeperLeague) {
      leagueInfo = {
        isDynasty: sleeperLeague.isDynasty,
        scoring: sleeperLeague.scoringType,
        totalTeams: sleeperLeague.totalTeams,
      };

      const profile = await (prisma as any).userProfile.findUnique({
        where: { userId },
        select: { sleeperUserId: true },
      });

      if (profile?.sleeperUserId) {
        rosterData = await (prisma as any).sleeperRoster.findFirst({
          where: { leagueId: sleeperLeague.id, ownerId: profile.sleeperUserId },
        });
      }
    }

    if (!rosterData) {
      const genericLeague = await (prisma as any).league.findFirst({
        where: { id: leagueId, userId },
        include: {
          rosters: {
            where: { platformUserId: userId },
            take: 1,
          },
        },
      });

      if (genericLeague?.rosters?.[0]) {
        leagueInfo = {
          isDynasty: genericLeague.isDynasty || false,
          scoring: genericLeague.scoring || 'ppr',
          totalTeams: genericLeague.leagueSize || 12,
        };
        rosterData = {
          starters: [],
          bench: [],
          faabRemaining: genericLeague.rosters[0].faabRemaining,
          players: genericLeague.rosters[0].playerData,
        };
      }
    }

    if (!rosterData) {
      return NextResponse.json(
        { error: 'No roster found for this league. Make sure your account is linked.' },
        { status: 404 }
      );
    }

    let playerNames: string[] = [];
    if (rosterData.playerData) {
      playerNames = extractPlayerNames(rosterData.playerData);
      if (playerNames.length > 0 && (!rosterData.starters || rosterData.starters.length === 0)) {
        const starterCount = Math.min(playerNames.length, Math.ceil(playerNames.length * 0.5));
        rosterData.starters = playerNames.slice(0, starterCount);
        rosterData.bench = playerNames.slice(starterCount);
      }
    }

    if (playerNames.length === 0) {
      const allIds = [
        ...(rosterData.starters || []),
        ...(rosterData.bench || []),
        ...(Array.isArray(rosterData.players) ? rosterData.players : []),
      ];
      playerNames = allIds.filter((id: string) => id && !id.startsWith('unowned_'));
    }

    const playerData = await getPlayerDataByNames(playerNames);

    const { insights, overallScore } = computeCategories(rosterData, playerData, leagueInfo);

    return NextResponse.json({ insights, overallScore });
  } catch (error: any) {
    console.error('[Legacy Report]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
