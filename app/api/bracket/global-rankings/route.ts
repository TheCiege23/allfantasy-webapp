import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROUND_PTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get("tournamentId")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)))

    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId is required" }, { status: 400 })
    }

    const tournament = await prisma.bracketTournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, season: true },
    })
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
    }

    const nodes = await prisma.bracketNode.findMany({
      where: { tournamentId },
      select: { id: true, round: true },
    })
    const nodeRoundMap = new Map(nodes.map((n) => [n.id, n.round]))

    const leagueIds = (
      await prisma.bracketLeague.findMany({
        where: { tournamentId },
        select: { id: true },
      })
    ).map((l) => l.id)

    if (leagueIds.length === 0) {
      return NextResponse.json({
        ok: true,
        tournament,
        rankings: [],
        totalEntries: 0,
        page,
        totalPages: 0,
      })
    }

    const totalEntries = await prisma.bracketEntry.count({
      where: { leagueId: { in: leagueIds } },
    })

    const allEntries = await prisma.bracketEntry.findMany({
      where: { leagueId: { in: leagueIds } },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        picks: { select: { nodeId: true, points: true, isCorrect: true, pickedTeamName: true } },
        league: { select: { name: true } },
      },
    })

    const ranked = allEntries.map((entry) => {
      let totalPoints = 0
      let correctPicks = 0
      let maxPossible = 0
      let championPick: string | null = null

      for (const pick of entry.picks) {
        const round = nodeRoundMap.get(pick.nodeId) ?? 0
        totalPoints += pick.points ?? 0
        if (pick.isCorrect === true) correctPicks++
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
        leagueName: entry.league.name,
        totalPoints,
        correctPicks,
        maxPossible,
        championPick,
      }
    })

    ranked.sort((a, b) => b.totalPoints - a.totalPoints || b.correctPicks - a.correctPicks)

    ranked.forEach((r, i) => (r as any).rank = i + 1)

    const start = (page - 1) * limit
    const paged = ranked.slice(start, start + limit)

    return NextResponse.json(
      {
        ok: true,
        tournament,
        rankings: paged,
        totalEntries,
        page,
        totalPages: Math.ceil(totalEntries / limit),
      },
      { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } }
    )
  } catch (err: any) {
    console.error("[bracket/global-rankings] Error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to fetch global rankings" },
      { status: 500 }
    )
  }
}
