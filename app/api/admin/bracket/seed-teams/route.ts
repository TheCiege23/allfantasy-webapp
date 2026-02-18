import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiUsage } from "@/lib/telemetry/usage"

export const dynamic = "force-dynamic"

type TeamAssignment = {
  slot: string
  homeTeamName?: string | null
  awayTeamName?: string | null
  seedHome?: number | null
  seedAway?: number | null
}

function authenticate(request: NextRequest): boolean {
  const headerSecret = request.headers.get("x-admin-secret")
  const adminSecret = process.env.BRACKET_ADMIN_SECRET || process.env.ADMIN_PASSWORD
  return !!(headerSecret && adminSecret && headerSecret === adminSecret)
}

export const POST = withApiUsage({
  endpoint: "/api/admin/bracket/seed-teams",
  tool: "BracketSeedTeams",
})(async (request: NextRequest) => {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { tournamentId, teams } = body as { tournamentId?: string; teams?: TeamAssignment[] }

    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId is required" }, { status: 400 })
    }

    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      return NextResponse.json({ error: "teams array is required with at least one entry" }, { status: 400 })
    }

    const tournament = await prisma.bracketTournament.findUnique({ where: { id: tournamentId } })
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
    }

    const allNodes = await prisma.bracketNode.findMany({
      where: { tournamentId },
      select: { id: true, slot: true, round: true },
    })
    const slotMap = new Map(allNodes.map((n: { id: string; slot: string; round: number }) => [n.slot, n]))

    const errors: string[] = []
    const txOps = []
    const applied: string[] = []

    for (const t of teams) {
      if (!t.slot) {
        errors.push("Entry missing slot field")
        continue
      }

      const node = slotMap.get(t.slot)
      if (!node) {
        errors.push(`Slot not found: ${t.slot}`)
        continue
      }

      const data: any = {}
      if (t.homeTeamName !== undefined) data.homeTeamName = t.homeTeamName
      if (t.awayTeamName !== undefined) data.awayTeamName = t.awayTeamName
      if (t.seedHome !== undefined) data.seedHome = t.seedHome
      if (t.seedAway !== undefined) data.seedAway = t.seedAway

      if (Object.keys(data).length === 0) {
        errors.push(`${t.slot}: no fields to update`)
        continue
      }

      txOps.push(
        prisma.bracketNode.update({
          where: { id: node.id },
          data,
        })
      )
      applied.push(`${t.slot}: ${JSON.stringify(data)}`)
    }

    if (errors.length > 0 && txOps.length === 0) {
      return NextResponse.json({ error: "All entries failed validation", details: errors }, { status: 400 })
    }

    await prisma.$transaction(txOps)

    return NextResponse.json({
      success: true,
      updated: txOps.length,
      applied,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    })
  } catch (err: any) {
    console.error("[BracketSeedTeams] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to seed teams" }, { status: 500 })
  }
})
