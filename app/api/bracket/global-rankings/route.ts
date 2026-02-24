import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreEntry, type ScoringMode, type PickResult, type LeaguePickDistribution, type BonusFlags, bonusFlagsFromRules, scoringConfigKey } from "@/lib/brackets/scoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get("tournamentId")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)))
    const filterMode = searchParams.get("scoringMode")
    const filterConfig = searchParams.get("scoringConfig")

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
      select: {
        id: true, round: true, seedHome: true, seedAway: true,
        homeTeamName: true, awayTeamName: true, sportsGameId: true,
      },
    })
    const nodeRoundMap = new Map(nodes.map((n) => [n.id, n.round]))
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    const seedMapLocal = new Map<string, number>()
    for (const n of nodes) {
      if (n.round === 1) {
        if (n.homeTeamName && n.seedHome != null) seedMapLocal.set(n.homeTeamName, n.seedHome)
        if (n.awayTeamName && n.seedAway != null) seedMapLocal.set(n.awayTeamName, n.seedAway)
      }
    }

    const linkedGameIds = nodes
      .map((n) => n.sportsGameId)
      .filter((id): id is string => id !== null)
    const games = linkedGameIds.length > 0
      ? await prisma.sportsGame.findMany({
          where: { id: { in: linkedGameIds } },
          select: { id: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, status: true },
        })
      : []
    const gameMap = new Map(games.map((g) => [g.id, g]))

    const decidedNodeIds = new Set<string>()
    const decidedPicks = await prisma.bracketPick.findMany({
      where: { node: { tournamentId }, isCorrect: { not: null } },
      select: { nodeId: true },
      distinct: ["nodeId"],
    })
    decidedPicks.forEach(p => decidedNodeIds.add(p.nodeId))
    const totalDecidedGames = decidedNodeIds.size

    let leagueWhere: any = { tournamentId }
    if (filterConfig) {
      const allLeagues = await prisma.bracketLeague.findMany({
        where: { tournamentId },
        select: { id: true, scoringRules: true },
      })
      const matchingIds = allLeagues
        .filter((l: any) => {
          const rules = (l.scoringRules || {}) as any
          const mode = (rules.scoringMode || rules.mode || "fancred_edge") as ScoringMode
          const flags = bonusFlagsFromRules(rules)
          return scoringConfigKey(mode, flags) === filterConfig
        })
        .map((l: any) => l.id)
      leagueWhere = { id: { in: matchingIds } }
    } else if (filterMode) {
      const allLeagues = await prisma.bracketLeague.findMany({
        where: { tournamentId },
        select: { id: true, scoringRules: true },
      })
      const matchingIds = allLeagues
        .filter((l: any) => {
          const rules = (l.scoringRules || {}) as any
          return (rules.scoringMode || rules.mode) === filterMode
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
        ok: true, tournament, rankings: [], totalEntries: 0, page, totalPages: 0,
      })
    }

    const totalEntries = await prisma.bracketEntry.count({
      where: { leagueId: { in: leagueIds } },
    })

    const leaguesWithRules = await prisma.bracketLeague.findMany({
      where: { id: { in: leagueIds } },
      select: { id: true, scoringRules: true },
    })
    const leagueModeMap = new Map<string, ScoringMode>()
    const leagueRulesMap = new Map<string, any>()
    for (const lg of leaguesWithRules) {
      const rules = (lg.scoringRules || {}) as any
      leagueModeMap.set(lg.id, (rules.scoringMode || rules.mode || "fancred_edge") as ScoringMode)
      leagueRulesMap.set(lg.id, rules)
    }

    const allEntries = await prisma.bracketEntry.findMany({
      where: { leagueId: { in: leagueIds } },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        picks: { select: { nodeId: true, isCorrect: true, pickedTeamName: true } },
        league: { select: { name: true, id: true } },
      },
    })

    const leagueDistributions = new Map<string, LeaguePickDistribution>()
    for (const entry of allEntries as any[]) {
      const lid = entry.league.id
      if (!leagueDistributions.has(lid)) leagueDistributions.set(lid, {})
      const dist = leagueDistributions.get(lid)!
      for (const pick of entry.picks) {
        if (!pick.pickedTeamName) continue
        if (!dist[pick.nodeId]) dist[pick.nodeId] = {}
        dist[pick.nodeId][pick.pickedTeamName] = (dist[pick.nodeId][pick.pickedTeamName] || 0) + 1
      }
    }

    const ROUND_PTS_DEFAULT: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 }
    const ROUND_PTS_EDGE: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 10, 5: 18, 6: 30 }

    const ranked = (allEntries as any[]).map((entry) => {
      const entryMode = leagueModeMap.get(entry.league.id) || "fancred_edge"
      const roundPts = entryMode === "fancred_edge" ? ROUND_PTS_EDGE : ROUND_PTS_DEFAULT
      const rules = leagueRulesMap.get(entry.league.id) || {}

      let correctPicks = 0
      let totalDecided = 0
      let maxPossible = 0
      let championPick: string | null = null
      let underdogPicks = 0
      let totalPicksMade = 0

      const pickResults: PickResult[] = entry.picks.map((pick: any) => {
        const round = nodeRoundMap.get(pick.nodeId) ?? 0
        if (decidedNodeIds.has(pick.nodeId)) {
          totalDecided++
          if (pick.isCorrect === true) correctPicks++
        }
        if (pick.isCorrect !== false && round >= 1 && round <= 6) {
          maxPossible += roundPts[round] ?? 0
        }
        if (round === 6 && pick.pickedTeamName) championPick = pick.pickedTeamName

        if (pick.pickedTeamName) {
          totalPicksMade++
          const node = nodeMap.get(pick.nodeId)
          if (node) {
            const pickedSeed = pick.pickedTeamName === node.homeTeamName ? node.seedHome : node.seedAway
            const otherSeed = pick.pickedTeamName === node.homeTeamName ? node.seedAway : node.seedHome
            if (pickedSeed != null && otherSeed != null && pickedSeed > otherSeed) underdogPicks++
          }
        }

        const node = nodeMap.get(pick.nodeId)
        const gameForNode = node?.sportsGameId ? gameMap.get(node.sportsGameId) : null
        let opponentSeed: number | null = null
        if (gameForNode && gameForNode.status === "final" && gameForNode.homeScore != null && gameForNode.awayScore != null) {
          const loser = gameForNode.homeScore > gameForNode.awayScore ? node?.awayTeamName : node?.homeTeamName
          opponentSeed = loser ? (seedMapLocal.get(loser) ?? null) : null
        } else if (node && pick.pickedTeamName) {
          const opponent = pick.pickedTeamName === node.homeTeamName ? node.awayTeamName : node.homeTeamName
          opponentSeed = opponent ? (seedMapLocal.get(opponent) ?? null) : null
        }

        return {
          nodeId: pick.nodeId,
          round,
          pickedTeamName: pick.pickedTeamName,
          isCorrect: pick.isCorrect,
          pickedSeed: pick.pickedTeamName ? (seedMapLocal.get(pick.pickedTeamName) ?? null) : null,
          actualWinnerSeed: null,
          opponentSeed,
        }
      })

      const leagueDist = leagueDistributions.get(entry.league.id) || {}
      const flags = bonusFlagsFromRules(rules)
      const insuranceNodeId = flags.insuranceEnabled ? (entry.insuredNodeId || null) : null
      const { total: totalPoints } = scoreEntry(entryMode, pickResults, leagueDist, insuranceNodeId, flags)
      const configKey = scoringConfigKey(entryMode, flags)

      const accuracy = totalDecided > 0 ? Math.round((correctPicks / totalDecided) * 1000) / 10 : 0
      const riskIndex = totalPicksMade > 0 ? Math.round((underdogPicks / totalPicksMade) * 100) : 0

      return {
        entryId: entry.id,
        entryName: entry.name,
        userId: entry.userId,
        displayName: entry.user.displayName,
        avatarUrl: entry.user.avatarUrl,
        leagueName: entry.league.name,
        scoringMode: entryMode,
        scoringConfig: configKey,
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

    const configCounts: Record<string, number> = {}
    for (const r of ranked) {
      configCounts[r.scoringConfig] = (configCounts[r.scoringConfig] || 0) + 1
    }
    const scoringConfigs = Object.entries(configCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }))

    const start = (page - 1) * limit
    const paged = ranked.slice(start, start + limit)

    return NextResponse.json(
      {
        ok: true,
        tournament,
        rankings: paged,
        totalEntries,
        totalDecidedGames,
        scoringConfigs,
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
