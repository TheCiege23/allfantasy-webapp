import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiUsage } from "@/lib/telemetry/usage"
import bracketStructure from "@/data/brackets/ncaam-structure.json"

export const dynamic = "force-dynamic"

type TemplateNode = (typeof bracketStructure.nodes)[number]

function validateNodes(nodes: TemplateNode[]): string[] {
  const errors: string[] = []
  const allSlots = new Set(nodes.map((n) => n.slot))

  const slotCounts = new Map<string, number>()
  for (const n of nodes) {
    slotCounts.set(n.slot, (slotCounts.get(n.slot) || 0) + 1)
  }
  for (const [slot, count] of slotCounts) {
    if (count > 1) errors.push(`Duplicate slot: ${slot}`)
  }

  for (const n of nodes) {
    if (n.nextSlot && !allSlots.has(n.nextSlot)) {
      errors.push(`${n.slot} references missing nextSlot: ${n.nextSlot}`)
    }
  }

  return errors
}

export const POST = withApiUsage({
  endpoint: "/api/admin/bracket/init",
  tool: "BracketInit",
})(async (request: NextRequest) => {
  try {
    const { password, season } = await request.json()

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    if (!season || typeof season !== "number") {
      return NextResponse.json({ error: "season (number) is required" }, { status: 400 })
    }

    const existing = await prisma.bracketTournament.findFirst({
      where: { sport: bracketStructure.sport, season },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Tournament already exists for ${bracketStructure.sport} ${season}`, tournamentId: existing.id },
        { status: 409 }
      )
    }

    const allNodes = bracketStructure.nodes

    const validationErrors = validateNodes(allNodes)
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "Bracket structure validation failed", details: validationErrors }, { status: 500 })
    }

    const tournament = await prisma.bracketTournament.create({
      data: {
        name: `${bracketStructure.name} ${season}`,
        season,
        sport: bracketStructure.sport,
      },
    })

    await prisma.$transaction(
      allNodes.map((n) =>
        prisma.bracketNode.create({
          data: {
            tournamentId: tournament.id,
            round: n.round,
            region: n.region,
            slot: n.slot,
            seedHome: n.seedHome,
            seedAway: n.seedAway,
            nextNodeSide: n.nextSide,
          },
        })
      )
    )

    const createdNodes = await prisma.bracketNode.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, slot: true },
    })
    const slotToId = new Map(createdNodes.map((n) => [n.slot, n.id]))

    const updates = allNodes
      .filter((n) => n.nextSlot)
      .map((n) => {
        const nodeId = slotToId.get(n.slot)
        const nextId = slotToId.get(n.nextSlot!)
        if (!nodeId || !nextId) return null
        return prisma.bracketNode.update({
          where: { id: nodeId },
          data: { nextNodeId: nextId },
        })
      })
      .filter(Boolean)

    if (updates.length > 0) {
      await prisma.$transaction(updates as any)
    }

    const roundCounts: Record<number, number> = {}
    for (const n of allNodes) {
      roundCounts[n.round] = (roundCounts[n.round] || 0) + 1
    }

    const summary = {
      tournamentId: tournament.id,
      name: tournament.name,
      season: tournament.season,
      sport: tournament.sport,
      totalNodes: createdNodes.length,
      byRound: {
        firstFour: roundCounts[0] || 0,
        roundOf64: roundCounts[1] || 0,
        roundOf32: roundCounts[2] || 0,
        sweet16: roundCounts[3] || 0,
        elite8: roundCounts[4] || 0,
        finalFour: roundCounts[5] || 0,
        championship: roundCounts[6] || 0,
      },
    }

    return NextResponse.json(summary, { status: 201 })
  } catch (err: any) {
    console.error("[BracketInit] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to initialize bracket" }, { status: 500 })
  }
})
