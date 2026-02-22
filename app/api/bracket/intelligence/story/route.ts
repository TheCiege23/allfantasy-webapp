import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { computeHealthScore, computeBracketUniqueness, computePickDistribution, runPoolSimulation, computeWinProbability } from "@/lib/brackets/intelligence/data-engine"
import { narrateStoryMode } from "@/lib/brackets/intelligence/ai-narrator"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const entryId = String(body.entryId || "")
  const leagueId = String(body.leagueId || "")

  if (!entryId) {
    return NextResponse.json({ error: "Missing entryId" }, { status: 400 })
  }

  const entry = await prisma.bracketEntry.findUnique({
    where: { id: entryId },
    include: {
      picks: { select: { nodeId: true, pickedTeamName: true, points: true, isCorrect: true } },
      league: { select: { id: true, tournamentId: true } },
    },
  })

  if (!entry || entry.userId !== auth.userId) {
    return NextResponse.json({ error: "Entry not found or forbidden" }, { status: 403 })
  }

  const health = await computeHealthScore(entryId, entry.league.tournamentId)

  const validPicks = entry.picks.filter(p => p.pickedTeamName != null) as Array<{ nodeId: string; pickedTeamName: string }>
  const distributions = await computePickDistribution(entry.league.tournamentId)
  const uniqueness = computeBracketUniqueness(validPicks, distributions)

  const winProbability = health.totalEntries > 1
    ? Math.max(0.01, 1 / health.totalEntries * (health.currentRank <= 3 ? 2 : 0.5))
    : 0.5

  const narrative = await narrateStoryMode({
    currentRank: health.currentRank,
    totalEntries: health.totalEntries,
    winProbability,
    uniquenessScore: uniqueness.score,
    alivePct: health.alivePct,
    currentPoints: health.currentPoints,
    maxPossible: health.maxPossiblePoints,
    riskExposure: health.riskExposure,
  })

  return NextResponse.json({
    ok: true,
    entryId,
    story: {
      narrative,
      health,
      uniqueness: { score: uniqueness.score, percentile: uniqueness.percentile },
      winProbability: Math.round(winProbability * 10000) / 100,
    },
  })
}
