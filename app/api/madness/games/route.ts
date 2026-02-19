import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const tournament = await (prisma as any).bracketTournament.findFirst({
    where: { sport: "ncaam" },
    orderBy: { season: "desc" },
    select: { id: true },
  })

  if (!tournament) {
    return NextResponse.json({ games: [] })
  }

  const games = await (prisma as any).marchMadnessGame.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ round: "asc" }, { region: "asc" }, { gameNumber: "asc" }],
    select: {
      id: true,
      round: true,
      gameNumber: true,
      region: true,
      team1: true,
      team2: true,
      team1Seed: true,
      team2Seed: true,
      winnerId: true,
      date: true,
      venue: true,
    },
  })

  return NextResponse.json({ games })
}
