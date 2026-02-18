import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiUsage } from "@/lib/telemetry/usage"

export const dynamic = "force-dynamic"

type TeamAssignment = {
  slot: string
  homeTeamName?: string | null
  awayTeamName?: string | null
}

function authenticate(request: NextRequest): boolean {
  const headerSecret = request.headers.get("x-admin-secret")
  const adminSecret = process.env.BRACKET_ADMIN_SECRET || process.env.ADMIN_PASSWORD
  return !!(headerSecret && adminSecret && headerSecret === adminSecret)
}

export const POST = withApiUsage({
  endpoint: "/api/admin/bracket/assign-teams",
  tool: "BracketAssignTeams",
})(async (request: NextRequest) => {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const validSlots = new Set<string>()
    const nodes = await prisma.bracketNode.findMany({
      where: { tournamentId: tournament.id },
      select: { slot: true },
    })
    for (const n of nodes) validSlots.add(n.slot)

    const errors: string[] = []
    const updates = []

    for (const t of teams) {
      if (!t.slot) {
        errors.push("Entry missing slot field")
        continue
      }
      if (!validSlots.has(t.slot)) {
        errors.push(`Unknown slot: ${t.slot}`)
        continue
      }

      const data: Record<string, string | null> = {}
      if (t.homeTeamName !== undefined) data.homeTeamName = t.homeTeamName ?? null
      if (t.awayTeamName !== undefined) data.awayTeamName = t.awayTeamName ?? null

      if (Object.keys(data).length === 0) {
        errors.push(`${t.slot}: no team names provided`)
        continue
      }

      updates.push(
        prisma.bracketNode.updateMany({
          where: { tournamentId: tournament.id, slot: t.slot },
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
