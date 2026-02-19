import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withApiUsage } from "@/lib/telemetry/usage"
import {
  generateNcaamBracketStructure,
  type GameSpec,
  type FirstFourMapping,
  type FinalFourMapping,
  type RegionKey,
  type Side,
} from "@/lib/brackets/ncaamStructure"

export const dynamic = "force-dynamic"

function validateGames(games: GameSpec[]): string[] {
  const errors: string[] = []
  const gameNumbers = new Map<number, number>()
  for (const g of games) {
    gameNumbers.set(g.gameNumber, (gameNumbers.get(g.gameNumber) || 0) + 1)
  }
  for (const [num, count] of gameNumbers) {
    if (count > 1) errors.push(`Duplicate gameNumber: ${num}`)
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
    const { isAuthorizedRequest, adminUnauthorized } = await import("@/lib/adminAuth")

    let body: any = {}
    try {
      body = await request.json()
    } catch {
    }

    if (!isAuthorizedRequest(request)) {
      return adminUnauthorized()
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

    const validationErrors = validateGames(structure.games)
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
      structure.games.map((g) =>
        (prisma as any).marchMadnessGame.create({
          data: {
            tournamentId: tournament.id,
            round: g.round,
            gameNumber: g.gameNumber,
            team1Seed: g.team1Seed ?? null,
            team2Seed: g.team2Seed ?? null,
          },
        })
      )
    )

    const createdGames = await (prisma as any).marchMadnessGame.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, gameNumber: true },
    })

    const roundCounts: Record<number, number> = {}
    for (const g of structure.games) {
      roundCounts[g.round] = (roundCounts[g.round] || 0) + 1
    }

    const summary = {
      tournamentId: tournament.id,
      name: tournament.name,
      season: tournament.season,
      sport: tournament.sport,
      totalGames: createdGames.length,
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
