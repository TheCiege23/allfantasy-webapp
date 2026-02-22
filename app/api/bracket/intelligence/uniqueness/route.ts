import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { computeBracketUniqueness, computePickDistribution } from "@/lib/brackets/intelligence/data-engine"

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
      picks: { select: { nodeId: true, pickedTeamName: true } },
      league: { select: { tournamentId: true } },
    },
  })

  if (!entry || entry.userId !== auth.userId) {
    return NextResponse.json({ error: "Entry not found or forbidden" }, { status: 403 })
  }

  const validPicks = entry.picks.filter(p => p.pickedTeamName != null) as Array<{ nodeId: string; pickedTeamName: string }>
  const distributions = await computePickDistribution(entry.league.tournamentId)
  const uniqueness = computeBracketUniqueness(validPicks, distributions)

  return NextResponse.json({
    ok: true,
    entryId,
    uniqueness: {
      score: uniqueness.score,
      percentile: uniqueness.percentile,
      label: uniqueness.score >= 80 ? "Highly Unique" : uniqueness.score >= 60 ? "Above Average" : uniqueness.score >= 40 ? "Moderate" : "Chalk-Heavy",
      topContributions: uniqueness.pickContributions
        .sort((a, b) => b.contribution - a.contribution)
        .slice(0, 5),
    },
  })
}
