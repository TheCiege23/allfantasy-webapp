import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { selectBestProvider } from "@/lib/brackets/providers"
import { generateNcaamBracketStructure } from "@/lib/brackets/ncaamStructure"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const season = Number(body?.season || new Date().getFullYear())

    const existing = await prisma.bracketTournament.findUnique({
      where: { sport_season: { sport: "ncaam", season } },
      select: { id: true },
    })

    const provider = await selectBestProvider()
    const caps = await provider.capabilities()

    console.log(`[AutoImport] Provider: ${provider.name}, checking field for season ${season}`)

    const field = caps.bracket_seeding
      ? await provider.getTournamentField(season)
      : null

    if (!field || !field.isFieldSet) {
      return NextResponse.json({
        ok: false,
        status: "waiting",
        message: "Tournament field not set yet. The 64-team bracket is not ready.",
        provider: provider.name,
        teamsFound: field?.teams?.length ?? 0,
      })
    }

    let tournamentId: string

    if (existing) {
      tournamentId = existing.id
    } else {
      const structure = generateNcaamBracketStructure({ season })
      const tournament = await prisma.bracketTournament.create({
        data: {
          name: structure.name,
          sport: structure.sport,
          season: structure.season,
          lockAt: field.lockTime,
        },
      })
      tournamentId = tournament.id

      const nodeData = structure.nodes.map((n) => ({
        tournamentId,
        round: n.round,
        region: n.region,
        slot: n.slot,
        seedHome: n.seedHome ?? null,
        seedAway: n.seedAway ?? null,
      }))

      await prisma.bracketNode.createMany({ data: nodeData })

      const allNodes = await prisma.bracketNode.findMany({
        where: { tournamentId },
        select: { id: true, slot: true },
      })
      const slotToId = new Map(allNodes.map((n) => [n.slot, n.id]))

      const updates = structure.nodes
        .filter((n) => n.nextSlot)
        .map((n) => {
          const nodeId = slotToId.get(n.slot)
          const nextId = slotToId.get(n.nextSlot!)
          if (!nodeId || !nextId) return null
          return prisma.bracketNode.update({
            where: { id: nodeId },
            data: {
              nextNodeId: nextId,
              nextNodeSide: n.nextSide === "HOME" ? "home" : "away",
            },
          })
        })
        .filter(Boolean)

      if (updates.length > 0) {
        await prisma.$transaction(updates as any)
      }

      console.log(`[AutoImport] Created tournament ${tournamentId} with ${nodeData.length} nodes`)
    }

    if (field.teams.length >= 64) {
      const nodes = await prisma.bracketNode.findMany({
        where: { tournamentId, round: 1 },
        select: { id: true, region: true, seedHome: true, seedAway: true },
      })

      const R64_MATCHUPS = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]]

      const teamByRegionSeed = new Map<string, string>()
      for (const t of field.teams) {
        teamByRegionSeed.set(`${t.region}-${t.seed}`, t.teamName)
      }

      let seeded = 0
      for (const node of nodes) {
        if (!node.region || node.seedHome == null || node.seedAway == null) continue
        const home = teamByRegionSeed.get(`${node.region}-${node.seedHome}`)
        const away = teamByRegionSeed.get(`${node.region}-${node.seedAway}`)
        if (home || away) {
          await prisma.bracketNode.update({
            where: { id: node.id },
            data: {
              ...(home ? { homeTeamName: home } : {}),
              ...(away ? { awayTeamName: away } : {}),
            },
          })
          seeded++
        }
      }

      console.log(`[AutoImport] Seeded ${seeded} R64 nodes with team names`)
    }

    const schedule = await provider.getSchedule(season)

    return NextResponse.json({
      ok: true,
      status: "imported",
      tournamentId,
      provider: provider.name,
      teamsImported: field.teams.length,
      gamesFromSchedule: schedule.length,
      lockTime: field.lockTime?.toISOString() ?? null,
    })
  } catch (err: any) {
    console.error("[AutoImport] Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
