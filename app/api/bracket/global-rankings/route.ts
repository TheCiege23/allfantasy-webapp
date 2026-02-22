import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROUND_PTS_DEFAULT: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 }
const ROUND_PTS_EDGE: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 10, 5: 18, 6: 30 }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get("tournamentId")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)))
    const filterMode = searchParams.get("scoringMode")

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
      select: { id: true, round: true, seedHome: true, seedAway: true, homeTeamName: true, awayTeamName: true },
    })
    const nodeRoundMap = new Map(nodes.map((n) => [n.id, n.round]))
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    const decidedNodeIds = new Set<string>()
    const decidedPicks = await prisma.bracketPick.findMany({
      where: {
        node: { tournamentId },
        isCorrect: { not: null },
      },
      select: { nodeId: true },
      distinct: ["nodeId"],
    })
    decidedPicks.forEach(p => decidedNodeIds.add(p.nodeId))

    const totalDecidedGames = decidedNodeIds.size

    let leagueWhere: any = { tournamentId }
    if (filterMode) {
      const allLeagues = await prisma.bracketLeague.findMany({
        where: { tournamentId },
        select: { id: true, scoringRules: true },
      })
      const matchingIds = allLeagues
        .filter((l: any) => {
          const rules = (l.scoringRules || {}) as any
          return (rules.mode || rules.scoringMode) === filterMode
        })
        .map((l: any) => l.id)
      leagueWhere = { id: { in: matchingIds } }
    }

    const leagueIds = (
      await prisma.bracketLeague.findMany({
        where: leagueWhere,
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

    const leaguesWithRules = await prisma.bracketLeague.findMany({
      where: { id: { in: leagueIds } },
      select: { id: true, scoringRules: true },
    })
    const leagueModeMap = new Map<string, string>()
    for (const lg of leaguesWithRules) {
      const rules = (lg.scoringRules || {}) as any
      leagueModeMap.set(lg.id, rules.mode || rules.scoringMode || "fancred_edge")
    }

    const allEntries = await prisma.bracketEntry.findMany({
      where: { leagueId: { in: leagueIds } },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        picks: { select: { nodeId: true, points: true, isCorrect: true, pickedTeamName: true } },
        league: { select: { name: true, id: true } },
      },
    })

    const ranked = allEntries.map((entry) => {
      let totalPoints = 0
      let correctPicks = 0
      let totalDecided = 0
      let maxPossible = 0
      let championPick: string | null = null
      let underdogPicks = 0
      let totalPicksMade = 0

      const entryMode = leagueModeMap.get(entry.league.id) || "fancred_edge"
      const roundPts = entryMode === "fancred_edge" ? ROUND_PTS_EDGE : ROUND_PTS_DEFAULT

      for (const pick of entry.picks) {
        const round = nodeRoundMap.get(pick.nodeId) ?? 0
        totalPoints += pick.points ?? 0

        if (decidedNodeIds.has(pick.nodeId)) {
          totalDecided++
          if (pick.isCorrect === true) correctPicks++
        }

        if (pick.isCorrect !== false && round >= 1 && round <= 6) {
          maxPossible += roundPts[round] ?? 0
        }
        if (round === 6 && pick.pickedTeamName) {
          championPick = pick.pickedTeamName
        }

        if (pick.pickedTeamName) {
          totalPicksMade++
          const node = nodeMap.get(pick.nodeId)
          if (node) {
            const pickedSeed = pick.pickedTeamName === (node as any).homeTeamName
              ? node.seedHome
              : node.seedAway
            const otherSeed = pick.pickedTeamName === (node as any).homeTeamName
              ? node.seedAway
              : node.seedHome
            if (pickedSeed != null && otherSeed != null && pickedSeed > otherSeed) {
              underdogPicks++
            }
          }
        }
      }

      const accuracy = totalDecided > 0 ? Math.round((correctPicks / totalDecided) * 1000) / 10 : 0
      const riskIndex = totalPicksMade > 0 ? Math.round((underdogPicks / totalPicksMade) * 100) : 0

      return {
        entryId: entry.id,
        entryName: entry.name,
        userId: entry.userId,
        displayName: entry.user.displayName,
        avatarUrl: entry.user.avatarUrl,
        leagueName: entry.league.name,
        totalPoints,
        correctPicks,
        totalDecided,
        maxPossible,
        championPick,
        accuracy,
        riskIndex,
        percentile: 0,
      }
    })

    ranked.sort((a, b) => b.totalPoints - a.totalPoints || b.correctPicks - a.correctPicks)

    ranked.forEach((r, i) => {
      ;(r as any).rank = i + 1
      r.percentile = ranked.length > 1
        ? Math.round(((ranked.length - 1 - i) / (ranked.length - 1)) * 1000) / 10
        : 100
    })

    const start = (page - 1) * limit
    const paged = ranked.slice(start, start + limit)

    return NextResponse.json(
      {
        ok: true,
        tournament,
        rankings: paged,
        totalEntries,
        totalDecidedGames,
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
