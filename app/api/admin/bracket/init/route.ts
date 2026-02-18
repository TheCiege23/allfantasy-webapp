import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiUsage } from "@/lib/telemetry/usage"
import {
  generateNcaamBracketStructure,
  type BracketNodeSeedSpec,
  type FirstFourMapping,
  type FinalFourMapping,
  type RegionKey,
  type Side,
} from "@/lib/brackets/ncaamStructure"

export const dynamic = "force-dynamic"

function validateNodes(nodes: BracketNodeSeedSpec[]): string[] {
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

const VALID_REGIONS: RegionKey[] = ["E", "W", "S", "M"]
const VALID_SIDES: Side[] = ["HOME", "AWAY"]

function parseFirstFour(input: any): FirstFourMapping | null {
  if (!input || typeof input !== "object") return null
  const keys = ["ff16A", "ff16B", "ff11A", "ff11B"] as const
  const result: any = {}
  for (const k of keys) {
    const entry = input[k]
    if (!entry || typeof entry.nextSlot !== "string" || !VALID_SIDES.includes(entry.nextSide)) {
      return null
    }
    result[k] = { nextSlot: entry.nextSlot, nextSide: entry.nextSide }
  }
  return result as FirstFourMapping
}

function parseFinalFour(input: any): FinalFourMapping | null {
  if (!input || typeof input !== "object") return null
  const allRegions = new Set<string>()
  for (const k of ["semi1", "semi2"] as const) {
    const entry = input[k]
    if (!entry || !VALID_REGIONS.includes(entry.regionA) || !VALID_REGIONS.includes(entry.regionB)) {
      return null
    }
    if (entry.regionA === entry.regionB) return null
    allRegions.add(entry.regionA)
    allRegions.add(entry.regionB)
  }
  if (allRegions.size !== 4) return null
  return input as FinalFourMapping
}

export const POST = withApiUsage({
  endpoint: "/api/admin/bracket/init",
  tool: "BracketInit",
})(async (request: NextRequest) => {
  try {
    const headerSecret = request.headers.get("x-admin-secret")
    const adminSecret = process.env.BRACKET_ADMIN_SECRET || process.env.ADMIN_PASSWORD

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // body may be empty when using query params + header auth
    }

    const authenticated =
      (headerSecret && headerSecret === adminSecret) ||
      (body.password && body.password === adminSecret)

    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seasonParam = request.nextUrl.searchParams.get("season")
    const season = body.season ?? (seasonParam ? parseInt(seasonParam, 10) : null)
    const { firstFour: firstFourInput, finalFour: finalFourInput } = body

    if (!season || isNaN(season)) {
      return NextResponse.json({ error: "season (number) is required — pass in body or ?season=YYYY" }, { status: 400 })
    }

    const existing = await prisma.bracketTournament.findUnique({
      where: { sport_season: { sport: "ncaam", season } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Tournament already exists for ncaam ${season}`, tournamentId: existing.id },
        { status: 409 }
      )
    }

    const firstFour = firstFourInput ? parseFirstFour(firstFourInput) : undefined
    const finalFour = finalFourInput ? parseFinalFour(finalFourInput) : undefined

    if (firstFourInput && !firstFour) {
      return NextResponse.json({ error: "Invalid firstFour mapping format" }, { status: 400 })
    }
    if (finalFourInput && !finalFour) {
      return NextResponse.json({ error: "Invalid finalFour mapping format" }, { status: 400 })
    }

    const structure = generateNcaamBracketStructure({
      season,
      firstFour: firstFour ?? undefined,
      finalFour: finalFour ?? undefined,
    })

    const validationErrors = validateNodes(structure.nodes)
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "Bracket structure validation failed", details: validationErrors }, { status: 500 })
    }

    const tournament = await prisma.bracketTournament.create({
      data: {
        name: `${structure.name} ${season}`,
        season,
        sport: structure.sport,
      },
    })

    await prisma.$transaction(
      structure.nodes.map((n) =>
        prisma.bracketNode.create({
          data: {
            tournamentId: tournament.id,
            round: n.round,
            region: n.region,
            slot: n.slot,
            seedHome: n.seedHome ?? null,
            seedAway: n.seedAway ?? null,
            nextNodeSide: n.nextSide ?? null,
          },
        })
      )
    )

    const createdNodes = await prisma.bracketNode.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, slot: true },
    })
    const slotToId = new Map(createdNodes.map((n) => [n.slot, n.id]))

    const updates = structure.nodes
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
    for (const n of structure.nodes) {
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
      config: {
        firstFourCustom: !!firstFourInput,
        finalFourCustom: !!finalFourInput,
      },
    }

    return NextResponse.json(summary, { status: 201 })
  } catch (err: any) {
    console.error("[BracketInit] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to initialize bracket" }, { status: 500 })
  }
})
