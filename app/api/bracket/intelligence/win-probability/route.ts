import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { computeWinProbability, runPoolSimulation } from "@/lib/brackets/intelligence/data-engine"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const leagueId = String(body.leagueId || "")
  const runs = Math.min(5000, Math.max(100, Number(body.runs) || 1000))

  if (!leagueId) {
    return NextResponse.json({ error: "Missing leagueId" }, { status: 400 })
  }

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: auth.userId } },
  })
  if (!member) {
    return NextResponse.json({ error: "Not a league member" }, { status: 403 })
  }

  const league = await prisma.bracketLeague.findUnique({
    where: { id: leagueId },
    select: { tournamentId: true },
  })
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 })
  }

  const entries = await prisma.bracketEntry.findMany({
    where: { leagueId },
    include: {
      user: { select: { id: true, displayName: true } },
      picks: {
        include: {
          node: { select: { id: true, round: true, seedHome: true, seedAway: true, homeTeamName: true, awayTeamName: true } },
        },
      },
    },
  })

  const nodes = await prisma.bracketNode.findMany({
    where: { tournamentId: league.tournamentId },
    include: { picks: { select: { isCorrect: true } } },
  })

  const decidedNodes = new Set(
    nodes.filter(n => n.picks.some(p => p.isCorrect !== null)).map(n => n.id)
  )

  const simEntries = entries.map(entry => {
    const currentPoints = entry.picks.reduce((s, p) => s + p.points, 0)

    const remainingPicks = entry.picks
      .filter(p => p.isCorrect === null && p.pickedTeamName && !decidedNodes.has(p.nodeId))
      .map(p => {
        const node = p.node
        const pickedTeam = p.pickedTeamName!
        const isFavorite = node.homeTeamName === pickedTeam
          ? (node.seedHome ?? 8) <= (node.seedAway ?? 8)
          : (node.seedAway ?? 8) <= (node.seedHome ?? 8)

        const seedA = isFavorite ? (node.seedHome ?? 8) : (node.seedAway ?? 8)
        const seedB = isFavorite ? (node.seedAway ?? 8) : (node.seedHome ?? 8)
        const prob = computeWinProbability(seedA, seedB)

        return {
          nodeId: p.nodeId,
          pickedTeamName: pickedTeam,
          round: node.round,
          winProb: isFavorite ? prob.teamA : prob.teamB,
        }
      })

    return {
      entryId: entry.id,
      userId: entry.userId,
      displayName: entry.user.displayName ?? "Unknown",
      currentPoints,
      remainingPicks,
    }
  })

  const results = runPoolSimulation(simEntries, runs)

  const enriched = results.map(r => {
    const entry = simEntries.find(e => e.entryId === r.entryId)
    return {
      ...r,
      displayName: entry?.displayName ?? "Unknown",
      currentPoints: entry?.currentPoints ?? 0,
      remainingGames: entry?.remainingPicks.length ?? 0,
    }
  }).sort((a, b) => b.winRate - a.winRate)

  return NextResponse.json({
    ok: true,
    leagueId,
    runs,
    results: enriched,
    timestamp: new Date().toISOString(),
  })
}
