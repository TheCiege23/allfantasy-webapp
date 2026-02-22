import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreMomentum, scoreAccuracyBoldness, scoreStreakSurvival, scoreFanCredEdge, type ScoringMode, type PickResult, type LeaguePickDistribution } from "@/lib/brackets/scoring"

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
    let scoringMode: ScoringMode = "momentum"
    if (leagueId) {
      const league = await prisma.bracketLeague.findUnique({
        where: { id: leagueId },
        select: { scoringRules: true },
      })
      const rules = (league?.scoringRules || {}) as any
      scoringMode = rules.mode || "momentum"

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

      const ROUND_PTS_DEFAULT: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 }
      const ROUND_PTS_EDGE: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 10, 5: 18, 6: 30 }
      const ROUND_PTS = scoringMode === "fancred_edge" ? ROUND_PTS_EDGE : ROUND_PTS_DEFAULT

      const seedMapLocal = new Map<string, number>()
      for (const n of nodes) {
        if (n.round === 1) {
          if (n.homeTeamName && n.seedHome != null) seedMapLocal.set(n.homeTeamName, n.seedHome)
          if (n.awayTeamName && n.seedAway != null) seedMapLocal.set(n.awayTeamName, n.seedAway)
        }
      }

      let leagueDistribution: LeaguePickDistribution = {}
      if (scoringMode === "accuracy_boldness" || scoringMode === "fancred_edge") {
        for (const entry of entries) {
          for (const pick of entry.picks) {
            if (!pick.pickedTeamName) continue
            if (!leagueDistribution[pick.nodeId]) leagueDistribution[pick.nodeId] = {}
            leagueDistribution[pick.nodeId][pick.pickedTeamName] =
              (leagueDistribution[pick.nodeId][pick.pickedTeamName] || 0) + 1
          }
        }
      }

      standings = entries.map((entry) => {
        let correctPicks = 0
        let totalPicks = 0
        const roundCorrect: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
        let championPick: string | null = null
        let maxPossible = 0

        const pickResults: PickResult[] = entry.picks.map((pick) => {
          const round = nodeRoundMap.get(pick.nodeId) ?? 0
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

          const node = nodes.find((n) => n.id === pick.nodeId)
          const gameForNode = node?.sportsGameId ? gameMap.get(node.sportsGameId) : null
          let actualWinnerSeed: number | null = null
          if (gameForNode && gameForNode.status === "final" && gameForNode.homeScore != null && gameForNode.awayScore != null) {
            const winner = gameForNode.homeScore > gameForNode.awayScore ? node?.homeTeamName : node?.awayTeamName
            actualWinnerSeed = winner ? (seedMapLocal.get(winner) ?? null) : null
          }

          return {
            nodeId: pick.nodeId,
            round,
            pickedTeamName: pick.pickedTeamName,
            isCorrect: pick.isCorrect,
            pickedSeed: pick.pickedTeamName ? (seedMapLocal.get(pick.pickedTeamName) ?? null) : null,
            actualWinnerSeed,
          }
        })

        let totalPoints = 0
        let details: any = null
        switch (scoringMode) {
          case "fancred_edge": {
            const result = scoreFanCredEdge(pickResults, leagueDistribution)
            totalPoints = result.total
            details = result
            break
          }
          case "accuracy_boldness": {
            const result = scoreAccuracyBoldness(pickResults, leagueDistribution)
            totalPoints = result.total
            details = result
            break
          }
          case "streak_survival": {
            const result = scoreStreakSurvival(pickResults)
            totalPoints = result.total
            details = { currentStreak: result.currentStreak, longestStreak: result.longestStreak }
            break
          }
          default: {
            const result = scoreMomentum(pickResults)
            totalPoints = result.total
            details = result
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
          scoringDetails: details,
        }
      })

      standings.sort((a, b) => b.totalPoints - a.totalPoints)
    }

    const seedMap = new Map<string, number>()
    for (const node of nodes) {
      if (node.round === 1) {
        if (node.homeTeamName && node.seedHome != null) seedMap.set(node.homeTeamName, node.seedHome)
        if (node.awayTeamName && node.seedAway != null) seedMap.set(node.awayTeamName, node.seedAway)
      }
    }

    const SEED_EXPECTED_WINS: Record<number, number> = {
      1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1,
      9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0,
    }

    const teamWins = new Map<string, number>()
    for (const bn of bracketNodes) {
      if (bn.winner) {
        teamWins.set(bn.winner, (teamWins.get(bn.winner) ?? 0) + 1)
      }
    }

    const sleeperTeams: string[] = []
    for (const [team, wins] of teamWins.entries()) {
      const seed = seedMap.get(team)
      if (seed == null) continue
      const baseline = SEED_EXPECTED_WINS[seed] ?? 0
      if (wins > baseline) {
        sleeperTeams.push(team)
      }
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
        sleeperTeams,
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
