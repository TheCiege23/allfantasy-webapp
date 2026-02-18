import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiUsage } from "@/lib/telemetry/usage"
import bracketStructure from "@/data/brackets/ncaam-structure.json"

export const dynamic = "force-dynamic"

type NodeRecord = {
  slot: string
  round: number
  region: string | null
  seedHome: number | null
  seedAway: number | null
  nextSlot: string | null
  nextSide: string | null
}

function buildAllNodes(): NodeRecord[] {
  const regions = bracketStructure.regions
  const r64Template = bracketStructure.bracketTemplate.roundOf64
  const nodes: NodeRecord[] = []

  for (const reg of regions) {
    const code = reg.code

    for (const m of r64Template) {
      const slot = `${code}-R64-${m.matchup}`
      const r32Matchup = Math.ceil(m.matchup / 2)
      const nextSlot = `${code}-R32-${r32Matchup}`
      const nextSide = m.matchup % 2 === 1 ? "HOME" : "AWAY"
      nodes.push({ slot, round: 1, region: reg.name, seedHome: m.seedHome, seedAway: m.seedAway, nextSlot, nextSide })
    }

    for (const m of bracketStructure.bracketTemplate.roundOf32) {
      const slot = `${code}-R32-${m.matchup}`
      const s16Matchup = Math.ceil(m.matchup / 2)
      const nextSlot = `${code}-S16-${s16Matchup}`
      const nextSide = m.matchup % 2 === 1 ? "HOME" : "AWAY"
      nodes.push({ slot, round: 2, region: reg.name, seedHome: null, seedAway: null, nextSlot, nextSide })
    }

    for (const m of bracketStructure.bracketTemplate.sweet16) {
      const slot = `${code}-S16-${m.matchup}`
      const nextSlot = `${code}-E8-1`
      const nextSide = m.matchup === 1 ? "HOME" : "AWAY"
      nodes.push({ slot, round: 3, region: reg.name, seedHome: null, seedAway: null, nextSlot, nextSide })
    }

    for (const m of bracketStructure.bracketTemplate.elite8) {
      const slot = `${code}-E8-${m.matchup}`
      const ff = bracketStructure.finalFour
      let nextSlot: string
      let nextSide: string
      if (code === ff.semi1.homeRegionCode) {
        nextSlot = ff.semi1.slot
        nextSide = "HOME"
      } else if (code === ff.semi1.awayRegionCode) {
        nextSlot = ff.semi1.slot
        nextSide = "AWAY"
      } else if (code === ff.semi2.homeRegionCode) {
        nextSlot = ff.semi2.slot
        nextSide = "HOME"
      } else {
        nextSlot = ff.semi2.slot
        nextSide = "AWAY"
      }
      nodes.push({ slot, round: 4, region: reg.name, seedHome: null, seedAway: null, nextSlot, nextSide })
    }
  }

  const ff = bracketStructure.finalFour
  const champSlot = bracketStructure.championship.slot
  nodes.push({ slot: ff.semi1.slot, round: 5, region: null, seedHome: null, seedAway: null, nextSlot: champSlot, nextSide: "HOME" })
  nodes.push({ slot: ff.semi2.slot, round: 5, region: null, seedHome: null, seedAway: null, nextSlot: champSlot, nextSide: "AWAY" })
  nodes.push({ slot: champSlot, round: 6, region: null, seedHome: null, seedAway: null, nextSlot: null, nextSide: null })

  for (const ffGame of bracketStructure.firstFour) {
    nodes.push({
      slot: ffGame.slot,
      round: 0,
      region: regions.find((r) => r.code === ffGame.regionCode)?.name ?? null,
      seedHome: ffGame.seedHome,
      seedAway: ffGame.seedAway,
      nextSlot: ffGame.targetSlot,
      nextSide: ffGame.targetSide,
    })
  }

  return nodes
}

function validateNodes(nodes: NodeRecord[]): string[] {
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

    const allNodes = buildAllNodes()

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

    const summary = {
      tournamentId: tournament.id,
      name: tournament.name,
      season: tournament.season,
      sport: tournament.sport,
      totalNodes: createdNodes.length,
      byRound: {
        firstFour: allNodes.filter((n) => n.round === 0).length,
        roundOf64: allNodes.filter((n) => n.round === 1).length,
        roundOf32: allNodes.filter((n) => n.round === 2).length,
        sweet16: allNodes.filter((n) => n.round === 3).length,
        elite8: allNodes.filter((n) => n.round === 4).length,
        finalFour: allNodes.filter((n) => n.round === 5).length,
        championship: allNodes.filter((n) => n.round === 6).length,
      },
    }

    return NextResponse.json(summary, { status: 201 })
  } catch (err: any) {
    console.error("[BracketInit] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to initialize bracket" }, { status: 500 })
  }
})
