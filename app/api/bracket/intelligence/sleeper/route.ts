import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { computeSleeperScore, computePickDistribution } from "@/lib/brackets/intelligence/data-engine"
import { narrateSleeper } from "@/lib/brackets/intelligence/ai-narrator"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const tournamentId = String(body.tournamentId || "")
  const round = Number(body.round) || 1
  const withNarrative = body.withNarrative === true

  if (!tournamentId) {
    return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 })
  }

  const nodes = await prisma.bracketNode.findMany({
    where: {
      tournamentId,
      round,
      homeTeamName: { not: null },
      awayTeamName: { not: null },
    },
    orderBy: [{ region: "asc" }, { slot: "asc" }],
  })

  if (nodes.length === 0) {
    return NextResponse.json({ ok: true, sleepers: [], message: "No matchups found for this round." })
  }

  const nodeIds = nodes.map(n => n.id)
  const distributions = await computePickDistribution(tournamentId, nodeIds)

  const sleepers: Array<{
    nodeId: string
    matchup: string
    region: string | null
    sleeper: ReturnType<typeof computeSleeperScore>
    narrative?: string
  }> = []

  for (const node of nodes) {
    if (!node.homeTeamName || !node.awayTeamName) continue

    const dist = distributions.get(node.id)
    const totalPicks = dist?.total ?? 0

    const homePct = totalPicks > 0 ? (dist!.picks[node.homeTeamName] ?? 0) / totalPicks : 0.5
    const awayPct = totalPicks > 0 ? (dist!.picks[node.awayTeamName] ?? 0) / totalPicks : 0.5

    const homeSleeper = computeSleeperScore(node.homeTeamName, node.seedHome, node.seedAway, homePct)
    const awaySleeper = computeSleeperScore(node.awayTeamName, node.seedAway, node.seedHome, awayPct)

    const best = homeSleeper.score >= awaySleeper.score ? homeSleeper : awaySleeper
    if (best.label === "none") continue

    const opponent = best.team === node.homeTeamName ? node.awayTeamName : node.homeTeamName
    const seedTeam = best.team === node.homeTeamName ? node.seedHome : node.seedAway
    const seedOpponent = best.team === node.homeTeamName ? node.seedAway : node.seedHome
    const publicPct = best.team === node.homeTeamName ? homePct : awayPct

    let narrative: string | undefined
    if (withNarrative) {
      narrative = await narrateSleeper({
        team: best.team,
        sleeperScore: best.score,
        label: best.label,
        opponent,
        seedTeam,
        seedOpponent,
        publicPickPct: publicPct,
        factors: best.factors,
      })
    }

    sleepers.push({
      nodeId: node.id,
      matchup: `${node.homeTeamName} vs ${node.awayTeamName}`,
      region: node.region,
      sleeper: best,
      narrative,
    })
  }

  sleepers.sort((a, b) => b.sleeper.score - a.sleeper.score)

  return NextResponse.json({ ok: true, sleepers, round, tournamentId })
}
