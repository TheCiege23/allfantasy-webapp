import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiUsage } from "@/lib/telemetry/usage"
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

type TeamAssignment = {
  round: number
  gameNumber: number
  team1?: string | null
  team2?: string | null
}

export const POST = withApiUsage({
  endpoint: "/api/admin/bracket/assign-teams",
  tool: "BracketAssignTeams",
})(async (request: NextRequest) => {
  try {
    if (!isAuthorizedRequest(request)) return adminUnauthorized()

    const body = await request.json()
    const { season, teams } = body as { season?: number; teams?: TeamAssignment[] }

    if (!season || typeof season !== "number") {
      return NextResponse.json({ error: "season (number) is required" }, { status: 400 })
    }

    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      return NextResponse.json({ error: "teams array is required" }, { status: 400 })
    }

    const tournament = await prisma.bracketTournament.findUnique({
      where: { sport_season: { sport: "ncaam", season } },
    })

    if (!tournament) {
      return NextResponse.json({ error: `No tournament found for ncaam ${season}` }, { status: 404 })
    }

    const games = await (prisma as any).marchMadnessGame.findMany({
      where: { tournamentId: tournament.id },
      select: { gameNumber: true, round: true },
    })
    const validGames = new Set(games.map((g: any) => `${g.round}-${g.gameNumber}`))

    const errors: string[] = []
    const updates = []

    for (const t of teams) {
      if (t.round == null || t.gameNumber == null) {
        errors.push("Entry missing round or gameNumber field")
        continue
      }
      const key = `${t.round}-${t.gameNumber}`
      if (!validGames.has(key)) {
        errors.push(`Unknown game: round=${t.round} gameNumber=${t.gameNumber}`)
        continue
      }

      const data: Record<string, string | null> = {}
      if (t.team1 !== undefined) data.team1 = t.team1 ?? null
      if (t.team2 !== undefined) data.team2 = t.team2 ?? null

      if (Object.keys(data).length === 0) {
        errors.push(`round=${t.round} gameNumber=${t.gameNumber}: no team names provided`)
        continue
      }

      updates.push(
        (prisma as any).marchMadnessGame.updateMany({
          where: { tournamentId: tournament.id, round: t.round, gameNumber: t.gameNumber },
          data,
        })
      )
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid assignments", details: errors }, { status: 400 })
    }

    await prisma.$transaction(updates)

    return NextResponse.json({
      ok: true,
      updated: updates.length,
      season,
      tournamentId: tournament.id,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    })
  } catch (err: any) {
    console.error("[BracketAssignTeams] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to assign teams" }, { status: 500 })
  }
})
