import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get("tournamentId")
    const leagueId = searchParams.get("leagueId")

    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId is required" }, { status: 400 })
    }

    const tournament = await prisma.bracketTournament.findUnique({
      where: { id: tournamentId },
    })
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
    }

    const games = await (prisma as any).marchMadnessGame.findMany({
      where: { tournamentId },
      orderBy: [{ round: "asc" }, { gameNumber: "asc" }],
    })

    const bracketNodes = games.map((game: any) => {
      return {
        id: game.id,
        gameNumber: game.gameNumber,
        round: game.round,
        team1Seed: game.team1Seed,
        team2Seed: game.team2Seed,
        team1: game.team1,
        team2: game.team2,
        date: game.date,
        venue: game.venue,
        winner: game.winnerId ?? null,
      }
    })

    let standings = null
    if (leagueId) {
      const entries = await prisma.bracketEntry.findMany({
        where: { leagueId },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          picks: true,
        },
        orderBy: { createdAt: "asc" },
      })

      standings = entries.map((entry) => {
        let totalPoints = 0
        let correctPicks = 0
        let totalPicks = 0

        for (const pick of entry.picks) {
          totalPoints += pick.points ?? 0
          if (pick.isCorrect === true) correctPicks++
          if (pick.isCorrect !== null) totalPicks++
        }

        return {
          entryId: entry.id,
          entryName: entry.name,
          userId: entry.userId,
          displayName: entry.user.displayName,
          avatarUrl: entry.user.avatarUrl,
          totalPoints,
          correctPicks,
          totalPicks,
        }
      })

      standings.sort((a, b) => b.totalPoints - a.totalPoints)
    }

    return NextResponse.json(
      {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          season: tournament.season,
          sport: tournament.sport,
        },
        nodes: bracketNodes,
        standings,
      },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    )
  } catch (err: any) {
    console.error("[BracketLive] Error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to fetch bracket data" },
      { status: 500 }
    )
  }
}
