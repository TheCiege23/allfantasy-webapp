import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreAndAdvanceFinals } from "@/lib/bracket-sync"

export const runtime = "nodejs"

function seededScore(nodeId: string, side: "home" | "away"): number {
  let hash = 0
  const key = `${nodeId}-${side}`
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return 60 + Math.abs(hash % 30)
}

function seededWinner(nodeId: string): boolean {
  let hash = 0
  for (let i = 0; i < nodeId.length; i++) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 2) === 0
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const season = body.season ?? new Date().getUTCFullYear()
  const roundToSimulate = body.round ?? 1
  const count = Math.min(body.count ?? 8, 32)

  const tournament = await prisma.bracketTournament.findUnique({
    where: { sport_season: { sport: "ncaam", season } },
    select: { id: true, name: true },
  })

  if (!tournament) {
    return NextResponse.json(
      { error: "Tournament not found. Seed it first via admin init." },
      { status: 404 }
    )
  }

  const nodes = await prisma.bracketNode.findMany({
    where: {
      tournamentId: tournament.id,
      round: roundToSimulate,
      homeTeamName: { not: null },
      awayTeamName: { not: null },
    },
    take: count,
    orderBy: { slot: "asc" },
  })

  if (nodes.length === 0) {
    return NextResponse.json(
      { error: `No nodes with teams assigned for round ${roundToSimulate}. Make sure bracket is seeded.` },
      { status: 404 }
    )
  }

  const created: string[] = []
  const updated: string[] = []

  for (const n of nodes) {
    if (!n.homeTeamName || !n.awayTeamName) continue

    const homeWins = seededWinner(n.id)
    const winScore = seededScore(n.id, "home")
    const loseScore = Math.max(40, winScore - 5 - (seededScore(n.id, "away") % 15))

    const homeScore = homeWins ? winScore : loseScore
    const awayScore = homeWins ? loseScore : winScore

    if (n.sportsGameId) {
      await prisma.sportsGame.update({
        where: { id: n.sportsGameId },
        data: {
          homeScore,
          awayScore,
          status: "final",
          startTime: new Date(Date.now() - 120_000),
          fetchedAt: new Date(),
        },
      })
      updated.push(`${n.homeTeamName} ${homeScore}-${awayScore} ${n.awayTeamName}`)
    } else {
      const game = await prisma.sportsGame.create({
        data: {
          sport: "ncaam",
          externalId: `dev-sim-${n.id}`,
          source: "dev-simulate",
          homeTeam: n.homeTeamName,
          awayTeam: n.awayTeamName,
          homeScore,
          awayScore,
          status: "final",
          startTime: new Date(Date.now() - 120_000),
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
          season,
        },
      })

      await prisma.bracketNode.update({
        where: { id: n.id },
        data: { sportsGameId: game.id },
      })
      created.push(`${n.homeTeamName} ${homeScore}-${awayScore} ${n.awayTeamName}`)
    }
  }

  const scoreResult = await scoreAndAdvanceFinals(tournament.id)

  return NextResponse.json({
    ok: true,
    tournament: tournament.name,
    round: roundToSimulate,
    gamesSimulated: created.length + updated.length,
    gamesCreated: created,
    gamesUpdated: updated,
    scoring: scoreResult,
    nextStep: "Refresh your bracket page to see updated scores, picks scored, and winners advanced.",
  })
}
