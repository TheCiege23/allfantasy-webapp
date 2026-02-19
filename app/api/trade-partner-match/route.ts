import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');

  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
  }

  try {
    const league = await (prisma as any).league.findFirst({
      where: {
        OR: [
          { id: leagueId, userId: session.user.id },
          { platformLeagueId: leagueId, userId: session.user.id },
        ],
      },
      include: {
        teams: {
          include: {
            legacyRoster: true,
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const teams: any[] = league.teams || [];

    const userTeam = teams.find(
      (t: any) =>
        t.legacyRoster?.isOwner === true ||
        t.legacyRoster?.ownerId === session.user!.id
    );

    if (!userTeam) {
      return NextResponse.json({ error: 'Your team not found in this league' }, { status: 404 });
    }

    const positionCounts = (roster: any): Record<string, number> => {
      if (!roster?.players) return {};
      const players: any[] = Array.isArray(roster.players) ? roster.players : [];
      const counts: Record<string, number> = {};
      for (const p of players) {
        const pos = (p.position || p.pos || 'UNKNOWN').toUpperCase();
        counts[pos] = (counts[pos] || 0) + 1;
      }
      return counts;
    };

    const detectNeeds = (counts: Record<string, number>): string[] => {
      const thresholds: Record<string, number> = { QB: 1, RB: 3, WR: 3, TE: 1, K: 1, DEF: 1 };
      const needs: string[] = [];
      for (const [pos, min] of Object.entries(thresholds)) {
        if ((counts[pos] || 0) < min) {
          needs.push(pos);
        }
      }
      return needs;
    };

    const detectStrengths = (counts: Record<string, number>): string[] => {
      const thresholds: Record<string, number> = { QB: 2, RB: 5, WR: 5, TE: 2, K: 2, DEF: 2 };
      const strengths: string[] = [];
      for (const [pos, surplus] of Object.entries(thresholds)) {
        if ((counts[pos] || 0) >= surplus) {
          strengths.push(pos);
        }
      }
      return strengths;
    };

    const userCounts = positionCounts(userTeam.legacyRoster);
    const userNeeds = detectNeeds(userCounts);
    const userStrengths = detectStrengths(userCounts);

    const otherTeams = teams.filter((t: any) => t.id !== userTeam.id);

    const matches = otherTeams
      .map((team: any) => {
        const teamCounts = positionCounts(team.legacyRoster);
        const teamNeeds = detectNeeds(teamCounts);
        const teamStrengths = detectStrengths(teamCounts);

        const theyHaveWhatWeNeed = userNeeds.filter((pos) => teamStrengths.includes(pos));
        const weHaveWhatTheyNeed = teamNeeds.filter((pos) => userStrengths.includes(pos));

        const overlapScore = theyHaveWhatWeNeed.length + weHaveWhatTheyNeed.length;
        const matchScore = Math.min(100, 30 + overlapScore * 20);

        let yourOffer = weHaveWhatTheyNeed.length > 0
          ? `Your ${weHaveWhatTheyNeed.join(', ')} depth`
          : 'Young talent / draft picks';

        let theirOffer = theyHaveWhatWeNeed.length > 0
          ? `Their ${theyHaveWhatWeNeed.join(', ')} depth`
          : 'Depth pieces';

        return {
          teamId: team.id,
          teamName: team.teamName || `${team.ownerName}'s Team`,
          record: `${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ''}`,
          needs: teamNeeds,
          strengths: teamStrengths,
          yourOffer,
          theirOffer,
          matchScore,
        };
      })
      .filter((m) => m.matchScore > 40)
      .sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({
      userTeam: {
        name: userTeam.teamName || userTeam.ownerName,
        needs: userNeeds,
        strengths: userStrengths,
      },
      matches,
    });
  } catch (err) {
    console.error('[trade-partner-match] Error:', err);
    return NextResponse.json({ error: 'Failed to find trade partners' }, { status: 500 });
  }
}
