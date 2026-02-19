import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiUsage } from "@/lib/telemetry/usage"
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

type WiringUpdate = {
  slot: string
  nextSlot: string
  nextSide: "HOME" | "AWAY"
}

export const POST = withApiUsage({
  endpoint: "/api/admin/bracket/update-wiring",
  tool: "BracketUpdateWiring",
})(async (request: NextRequest) => {
  try {
    if (!isAuthorizedRequest(request)) return adminUnauthorized()

    const body = await request.json()
    const { tournamentId, season, updates } = body as { tournamentId?: string; season?: number; updates?: WiringUpdate[] }

    if (!tournamentId && !season) {
      return NextResponse.json({ error: "tournamentId or season is required" }, { status: 400 })
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates array is required with at least one entry" }, { status: 400 })
    }

    const validSides = new Set(["HOME", "AWAY"])
    for (const u of updates) {
      if (!u.slot || !u.nextSlot || !validSides.has(u.nextSide)) {
        return NextResponse.json(
          { error: `Invalid update entry: each needs slot, nextSlot, nextSide (HOME|AWAY). Got: ${JSON.stringify(u)}` },
          { status: 400 }
        )
      }
    }

    const tournament = tournamentId
      ? await prisma.bracketTournament.findUnique({ where: { id: tournamentId } })
      : await prisma.bracketTournament.findUnique({ where: { sport_season: { sport: "ncaam", season: season! } } })
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 })
    }

    const allNodes = await prisma.bracketNode.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, slot: true },
    })
    const slotToId = new Map(allNodes.map((n: { id: string; slot: string }) => [n.slot, n.id]))

    const errors: string[] = []
    const txOps = []

    for (const u of updates) {
      const sourceId = slotToId.get(u.slot)
      const targetId = slotToId.get(u.nextSlot)

      if (!sourceId) {
        errors.push(`Source slot not found: ${u.slot}`)
        continue
      }
      if (!targetId) {
        errors.push(`Target slot not found: ${u.nextSlot}`)
        continue
      }

      txOps.push(
        prisma.bracketNode.update({
          where: { id: sourceId },
          data: {
            nextNodeId: targetId,
            nextNodeSide: u.nextSide,
          },
        })
      )
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Some slots not found", details: errors }, { status: 400 })
    }

    await prisma.$transaction(txOps)

    return NextResponse.json({
      success: true,
      updated: updates.length,
      details: updates.map((u) => `${u.slot} → ${u.nextSlot} (${u.nextSide})`),
    })
  } catch (err: any) {
    console.error("[BracketUpdateWiring] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to update wiring" }, { status: 500 })
  }
})
