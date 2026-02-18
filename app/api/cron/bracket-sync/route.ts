import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizeTeamName, isPlaceholderTeam } from "@/lib/brackets/normalize"
import { pointsForRound } from "@/lib/brackets/scoring"
import { fetchTournamentEvents, upsertEventsToSportsGame } from "@/lib/bracket-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function authenticate(request: NextRequest): boolean {
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-admin-secret")
  const cronSecret = process.env.BRACKET_CRON_SECRET
  const adminSecret = process.env.BRACKET_ADMIN_SECRET || process.env.ADMIN_PASSWORD
  return !!(headerSecret && (
    (cronSecret && headerSecret === cronSecret) ||
    (adminSecret && headerSecret === adminSecret)
  ))
}

function winnerFromSportsGame(g: { homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null }): string | null {
  if (g.homeScore == null || g.awayScore == null) return null
  if (g.homeScore === g.awayScore) return null
  return g.homeScore > g.awayScore ? g.homeTeam : g.awayTeam
}

function isFinalStatus(status?: string | null): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return s === "final" || s === "ft" || s.includes("final")
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seasonParam = request.nextUrl.searchParams.get("season")
    const sport = request.nextUrl.searchParams.get("sport") || "ncaam"
    let season: number

    if (seasonParam) {
      season = parseInt(seasonParam, 10)
      if (isNaN(season)) {
        return NextResponse.json({ error: "Invalid season parameter" }, { status: 400 })
      }
    } else {
      const now = new Date()
      season = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
    }

    let eventsIngested = 0
    try {
      const events = await fetchTournamentEvents(season)
      eventsIngested = await upsertEventsToSportsGame(events)
    } catch (err: any) {
      console.error("[BracketCronSync] Ingestion error (continuing):", err.message)
    }

    const tournament = await prisma.bracketTournament.findUnique({
      where: { sport_season: { sport, season } },
    })

    if (!tournament) {
      return NextResponse.json({
        ok: true,
        eventsIngested,
        tournament: null,
        linked: 0,
        finalized: 0,
        advanced: 0,
        message: `No tournament found for ${sport} ${season}`,
      })
    }

    const nodes = await prisma.bracketNode.findMany({
      where: { tournamentId: tournament.id },
      select: {
        id: true,
        slot: true,
        round: true,
        homeTeamName: true,
        awayTeamName: true,
        sportsGameId: true,
        nextNodeId: true,
        nextNodeSide: true,
      },
    })

    const games = await prisma.sportsGame.findMany({
      where: { sport, season },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        homeScore: true,
        awayScore: true,
        status: true,
        startTime: true,
      },
      orderBy: { startTime: "asc" },
      take: 2000,
    })

    const gameIndex = new Map(games.map((g) => [g.id, g]))

    let linked = 0
    const unlinkedNodes = nodes.filter(
      (n: typeof nodes[0]) =>
        !n.sportsGameId &&
        n.homeTeamName &&
        n.awayTeamName &&
        !isPlaceholderTeam(n.homeTeamName) &&
        !isPlaceholderTeam(n.awayTeamName)
    )

    const mapTeamsToGame = new Map<string, typeof games[0]>()
    for (const g of games) {
      const a = normalizeTeamName(g.homeTeam)
      const b = normalizeTeamName(g.awayTeam)
      const key1 = `${a}|${b}`
      const key2 = `${b}|${a}`
      if (!mapTeamsToGame.has(key1)) mapTeamsToGame.set(key1, g)
      if (!mapTeamsToGame.has(key2)) mapTeamsToGame.set(key2, g)
    }

    const linkTx = []
    for (const n of unlinkedNodes) {
      const key = `${normalizeTeamName(n.homeTeamName)}|${normalizeTeamName(n.awayTeamName)}`
      const match = mapTeamsToGame.get(key)
      if (!match) continue

      linkTx.push(
        prisma.bracketNode.update({
          where: { id: n.id },
          data: { sportsGameId: match.id },
        })
      )
    }

    if (linkTx.length > 0) {
      await prisma.$transaction(linkTx)
      linked = linkTx.length
    }

    const nodesAfterLink = await prisma.bracketNode.findMany({
      where: { tournamentId: tournament.id, sportsGameId: { not: null } },
      select: {
        id: true,
        slot: true,
        round: true,
        homeTeamName: true,
        awayTeamName: true,
        sportsGameId: true,
        nextNodeId: true,
        nextNodeSide: true,
      },
    })

    let finalized = 0
    let advanced = 0

    for (const node of nodesAfterLink) {
      const g = node.sportsGameId ? gameIndex.get(node.sportsGameId) : null
      if (!g) continue
      if (!isFinalStatus(g.status)) continue

      const rawWinner = winnerFromSportsGame(g)
      if (!rawWinner) continue
      if (!node.homeTeamName || !node.awayTeamName) continue

      const normalizedWinner = normalizeTeamName(rawWinner)
      let winner: string
      if (normalizeTeamName(node.homeTeamName) === normalizedWinner) {
        winner = node.homeTeamName
      } else if (normalizeTeamName(node.awayTeamName) === normalizedWinner) {
        winner = node.awayTeamName
      } else {
        continue
      }

      const pts = pointsForRound(node.round)

      await prisma.bracketPick.updateMany({
        where: {
          nodeId: node.id,
          pickedTeamName: winner,
        },
        data: {
          isCorrect: true,
          points: pts,
        },
      })

      await prisma.bracketPick.updateMany({
        where: {
          nodeId: node.id,
          pickedTeamName: { not: null },
          NOT: { pickedTeamName: winner },
        },
        data: {
          isCorrect: false,
          points: 0,
        },
      })

      finalized++

      if (node.nextNodeId && node.nextNodeSide) {
        const next = await prisma.bracketNode.findUnique({
          where: { id: node.nextNodeId },
          select: { id: true, homeTeamName: true, awayTeamName: true },
        })

        if (next) {
          const field = node.nextNodeSide === "HOME" ? "homeTeamName" : "awayTeamName"
          const currentVal = node.nextNodeSide === "HOME" ? next.homeTeamName : next.awayTeamName

          if (isPlaceholderTeam(currentVal)) {
            await prisma.bracketNode.update({
              where: { id: next.id },
              data: { [field]: winner },
            })
            advanced++
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tournament: { sport, season, id: tournament.id },
      eventsIngested,
      linked,
      finalized,
      advanced,
    })
  } catch (err: any) {
    console.error("[BracketCronSync] Error:", err)
    return NextResponse.json({ error: err.message || "Sync failed" }, { status: 500 })
  }
}
