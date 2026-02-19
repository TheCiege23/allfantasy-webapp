import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedRequest, adminUnauthorized } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { triggerChimmyForLeague, triggerChimmyForAllLeagues } from '@/lib/chimmy-storyline';

export async function POST(req: NextRequest) {
  if (!(await isAuthorizedRequest(req))) {
    return adminUnauthorized();
  }

  try {
    const { leagueId, tournamentId } = await req.json();

    let results: any[] = [];

    if (tournamentId) {
      const recentGames = await (prisma as any).marchMadnessGame.findMany({
        where: { tournamentId, winnerId: { not: null } },
        select: {
          team1: true,
          team2: true,
          winnerId: true,
          team1Seed: true,
          team2Seed: true,
          round: true,
          region: true,
        },
        orderBy: { date: 'desc' },
        take: 10,
      });

      results = recentGames.map((g: any) => ({
        team1: g.team1,
        team2: g.team2,
        winnerId: g.winnerId,
        team1Seed: g.team1Seed,
        team2Seed: g.team2Seed,
        round: g.round,
        region: g.region,
      }));
    } else {
      const tournament = await prisma.bracketTournament.findFirst({
        orderBy: { season: 'desc' },
        select: { id: true },
      });

      if (tournament) {
        const recentGames = await (prisma as any).marchMadnessGame.findMany({
          where: { tournamentId: tournament.id, winnerId: { not: null } },
          select: {
            team1: true,
            team2: true,
            winnerId: true,
            team1Seed: true,
            team2Seed: true,
            round: true,
            region: true,
          },
          orderBy: { date: 'desc' },
          take: 10,
        });

        results = recentGames.map((g: any) => ({
          team1: g.team1,
          team2: g.team2,
          winnerId: g.winnerId,
          team1Seed: g.team1Seed,
          team2Seed: g.team2Seed,
          round: g.round,
          region: g.region,
        }));
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'No finalized game results found' }, { status: 400 });
    }

    if (leagueId) {
      const { posted, storyline } = await triggerChimmyForLeague(leagueId, results);
      return NextResponse.json({ posted, storyline, leagueId });
    }

    const { leaguesNotified } = await triggerChimmyForAllLeagues(results);
    return NextResponse.json({ leaguesNotified, resultsUsed: results.length });
  } catch (err) {
    console.error('[Chimmy API Error]', err);
    return NextResponse.json({ error: 'Failed to generate storyline' }, { status: 500 });
  }
}
