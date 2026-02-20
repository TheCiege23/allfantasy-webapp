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

    const nodes = await prisma.bracketNode.findMany({
      where: { tournamentId },
      orderBy: [{ round: "asc" }, { slot: "asc" }],
    })

    const linkedGameIds = nodes
      .map((n) => n.sportsGameId)
      .filter((id): id is string => id !== null)

    const games = linkedGameIds.length > 0
      ? await prisma.sportsGame.findMany({
          where: { id: { in: linkedGameIds } },
          select: {
            id: true,
            homeTeam: true,
            awayTeam: true,
            homeScore: true,
            awayScore: true,
            status: true,
            startTime: true,
            venue: true,
            fetchedAt: true,
          },
        })
      : []

    const gameMap = new Map(games.map((g) => [g.id, g]))

    const bracketNodes = nodes.map((node) => {
      const game = node.sportsGameId ? gameMap.get(node.sportsGameId) : null
      return {
        id: node.id,
        slot: node.slot,
        round: node.round,
        region: node.region,
        seedHome: node.seedHome,
        seedAway: node.seedAway,
        homeTeamName: node.homeTeamName,
        awayTeamName: node.awayTeamName,
        nextNodeId: node.nextNodeId,
        nextNodeSide: node.nextNodeSide,
        liveGame: game
          ? {
              homeScore: game.homeScore,
              awayScore: game.awayScore,
              status: game.status,
              startTime: game.startTime,
              venue: game.venue,
              fetchedAt: game.fetchedAt,
            }
          : null,
        winner:
          game?.status === "final" &&
          game.homeScore != null &&
          game.awayScore != null &&
          game.homeScore !== game.awayScore
            ? game.homeScore > game.awayScore
              ? node.homeTeamName
              : node.awayTeamName
            : null,
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

      const nodeRoundMap = new Map<string, number>()
      for (const n of nodes) nodeRoundMap.set(n.id, n.round)

      const ROUND_MAX: Record<number, number> = { 1: 32, 2: 16, 3: 8, 4: 4, 5: 2, 6: 1 }
      const ROUND_PTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 }

      standings = entries.map((entry) => {
        let totalPoints = 0
        let correctPicks = 0
        let totalPicks = 0
        const roundCorrect: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

        let championPick: string | null = null
        let maxPossible = 0

        for (const pick of entry.picks) {
          const round = nodeRoundMap.get(pick.nodeId) ?? 0
          totalPoints += pick.points ?? 0
          if (pick.isCorrect === true) {
            correctPicks++
            if (round >= 1 && round <= 6) roundCorrect[round]++
          }
          if (pick.isCorrect !== null) totalPicks++

          if (pick.isCorrect !== false && round >= 1 && round <= 6) {
            maxPossible += ROUND_PTS[round] ?? 0
          }

          if (round === 6 && pick.pickedTeamName) {
            championPick = pick.pickedTeamName
          }
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
          roundCorrect,
          championPick,
          maxPossible,
        }
      })

      standings.sort((a, b) => b.totalPoints - a.totalPoints)
    }

    const hasLiveGames = bracketNodes.some(
      (n) => n.liveGame?.status === "in_progress"
    )

    const gamesFlat = games.map((g) => ({
      id: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      status: g.status,
      startTime: g.startTime ? g.startTime.toISOString() : null,
    }))

    return NextResponse.json(
      {
        ok: true,
        tournamentId: tournament.id,
        tournament: {
          id: tournament.id,
          name: tournament.name,
          season: tournament.season,
          sport: tournament.sport,
        },
        games: gamesFlat,
        nodes: bracketNodes,
        standings,
        hasLiveGames,
        pollIntervalMs: hasLiveGames ? 10000 : 60000,
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
