import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import RankingsClient from "./RankingsClient";

export const metadata: Metadata = {
  title: "League Power Rankings \u2013 AllFantasy",
  description: "AI-powered power rankings, trends, strengths & risks for your fantasy league.",
};

export default async function RankingsPage() {
  const teams = await prisma.leagueTeam.findMany({
    take: 12,
    orderBy: [
      { aiPowerScore: { sort: "desc", nulls: "last" } },
      { pointsFor: "desc" },
    ],
    include: {
      league: { select: { name: true, sport: true, season: true, scoring: true, leagueSize: true } },
    },
  });

  const serialized = teams.map((t, i) => ({
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
    leagueName: t.league?.name ?? null,
    leagueSport: t.league?.sport ?? null,
    leagueSeason: t.league?.season ?? null,
    leagueScoring: t.league?.scoring ?? null,
    leagueSize: t.league?.leagueSize ?? null,
  }));

  return <RankingsClient teams={serialized} />;
}
