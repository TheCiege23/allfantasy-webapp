import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RankingsClient from "./RankingsClient";

export const metadata: Metadata = {
  title: "League Power Rankings \u2013 AllFantasy",
  description: "AI-powered power rankings, trends, strengths & risks for your fantasy league.",
};

function serializeLeague(league: any) {
  return {
    id: league.id,
    name: league.name,
    sport: league.sport,
    season: league.season,
    scoring: league.scoring,
    leagueSize: league.leagueSize,
    teams: (league.teams || []).map((t: any, i: number) => ({
      id: t.id,
      teamName: t.teamName,
      ownerName: t.ownerName,
      pointsFor: t.pointsFor,
      pointsAgainst: t.pointsAgainst,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      currentRank: t.currentRank ?? i + 1,
      aiPowerScore: t.aiPowerScore,
      projectedWins: t.projectedWins,
      strengthNotes: t.strengthNotes,
      riskNotes: t.riskNotes,
      avatarUrl: t.avatarUrl,
    })),
  };
}

export default async function RankingsPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  const userId = session?.user?.id ?? null;

  const leagues = await prisma.league.findMany({
    where: userId ? { userId } : undefined,
    take: 10,
    orderBy: { updatedAt: "desc" },
    include: {
      teams: {
        orderBy: [
          { aiPowerScore: { sort: "desc", nulls: "last" } },
          { pointsFor: "desc" },
        ],
      },
    },
  });

  const serializedLeagues = leagues.map(serializeLeague);

  return (
    <RankingsClient
      leagues={serializedLeagues}
      isSignedIn={!!userId}
    />
  );
}
