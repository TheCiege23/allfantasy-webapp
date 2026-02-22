import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { computePickDistribution, computePostTournamentInsights } from "@/lib/brackets/intelligence/data-engine"
import { narratePostTournament } from "@/lib/brackets/intelligence/ai-narrator"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const entryId = String(body.entryId || "")

  if (!entryId) {
    return NextResponse.json({ error: "Missing entryId" }, { status: 400 })
  }

  const entry = await prisma.bracketEntry.findUnique({
    where: { id: entryId },
    include: {
      picks: {
        include: {
          node: { select: { id: true, round: true, seedHome: true, seedAway: true, homeTeamName: true, awayTeamName: true } },
        },
      },
      league: { select: { tournamentId: true } },
    },
  })

  if (!entry || entry.userId !== auth.userId) {
    return NextResponse.json({ error: "Entry not found or forbidden" }, { status: 403 })
  }

  const distributions = await computePickDistribution(entry.league.tournamentId)

  const allEntries = await prisma.bracketEntry.findMany({
    where: { league: { tournamentId: entry.league.tournamentId } },
    include: { picks: { select: { points: true } } },
  })

  const entryScores = allEntries
    .map(e => ({ entryId: e.id, total: e.picks.reduce((s, p) => s + p.points, 0) }))
    .sort((a, b) => b.total - a.total)

  const finalRank = entryScores.findIndex(e => e.entryId === entryId) + 1

  const picksWithMeta = entry.picks.map(p => {
    const node = p.node
    const pickedSeed = p.pickedTeamName === node.homeTeamName ? node.seedHome : node.seedAway
    const actualWinnerSeed = p.isCorrect === true
      ? pickedSeed
      : p.isCorrect === false
        ? (p.pickedTeamName === node.homeTeamName ? node.seedAway : node.seedHome)
        : null

    return {
      nodeId: p.nodeId,
      pickedTeamName: p.pickedTeamName,
      isCorrect: p.isCorrect,
      points: p.points,
      round: node.round,
      seedPicked: pickedSeed,
      seedActualWinner: actualWinnerSeed,
    }
  })

  const insights = computePostTournamentInsights(picksWithMeta, distributions)

  const narrative = await narratePostTournament({
    ...insights,
    finalRank,
    totalEntries: allEntries.length,
  })

  return NextResponse.json({
    ok: true,
    entryId,
    finalRank,
    totalEntries: allEntries.length,
    insights,
    narrative,
  })
}
