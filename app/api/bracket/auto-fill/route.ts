import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const auth = await requireVerifiedUser()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({} as any))
    const entryId = String(body?.entryId || "")
    if (!entryId) {
      return NextResponse.json({ error: "Missing entryId" }, { status: 400 })
    }

    const entry = await prisma.bracketEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        userId: true,
        league: {
          select: {
            tournamentId: true,
            tournament: { select: { lockAt: true } },
          },
        },
      },
    })

    if (!entry || entry.userId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tournament = entry.league.tournament
    const tournamentLockAt = tournament?.lockAt
    const now = new Date()

    if (tournamentLockAt && new Date(tournamentLockAt) <= now) {
      return NextResponse.json(
        { error: "Bracket is locked — auto-fill is no longer available" },
        { status: 409 }
      )
    }

    const nodes = await prisma.bracketNode.findMany({
      where: { tournamentId: entry.league.tournamentId },
      orderBy: [{ round: "asc" }, { slot: "asc" }],
    })

    const existingPicks = await prisma.bracketPick.findMany({
      where: { entryId },
      select: { nodeId: true, pickedTeamName: true },
    })

    const pickMap: Record<string, string | null> = {}
    for (const p of existingPicks) pickMap[p.nodeId] = p.pickedTeamName

    const seedMap = new Map<string, number>()
    for (const n of nodes) {
      if (n.round === 1) {
        if (n.homeTeamName && n.seedHome != null) seedMap.set(n.homeTeamName, n.seedHome)
        if (n.awayTeamName && n.seedAway != null) seedMap.set(n.awayTeamName, n.seedAway)
      }
    }

    const effective = new Map<string, { home: string | null; away: string | null }>()
    for (const n of nodes) {
      effective.set(n.id, { home: n.homeTeamName, away: n.awayTeamName })
    }

    const sorted = [...nodes].sort((a, b) => a.round - b.round)
    let newPicksCount = 0
    const toUpsert: { nodeId: string; pickedTeamName: string }[] = []

    for (const n of sorted) {
      const existingPick = pickMap[n.id]
      if (existingPick) {
        if (n.nextNodeId && n.nextNodeSide) {
          const cur = effective.get(n.nextNodeId)
          if (cur) {
            if (n.nextNodeSide === "home") {
              effective.set(n.nextNodeId, { ...cur, home: existingPick })
            } else {
              effective.set(n.nextNodeId, { ...cur, away: existingPick })
            }
          }
        }
        continue
      }

      const eff = effective.get(n.id)
      if (!eff) continue

      const home = eff.home
      const away = eff.away

      if (!home && !away) continue

      let pick: string | null = null

      if (home && !away) {
        pick = home
      } else if (!home && away) {
        pick = away
      } else if (home && away) {
        const homeSeed = seedMap.get(home) ?? 99
        const awaySeed = seedMap.get(away) ?? 99
        pick = homeSeed <= awaySeed ? home : away
      }

      if (pick) {
        pickMap[n.id] = pick
        toUpsert.push({ nodeId: n.id, pickedTeamName: pick })
        newPicksCount++

        if (n.nextNodeId && n.nextNodeSide) {
          const cur = effective.get(n.nextNodeId)
          if (cur) {
            if (n.nextNodeSide === "home") {
              effective.set(n.nextNodeId, { ...cur, home: pick })
            } else {
              effective.set(n.nextNodeId, { ...cur, away: pick })
            }
          }
        }
      }
    }

    if (toUpsert.length > 0) {
      await prisma.$transaction(
        toUpsert.map((p) =>
          prisma.bracketPick.upsert({
            where: { entryId_nodeId: { entryId, nodeId: p.nodeId } },
            update: { pickedTeamName: p.pickedTeamName },
            create: { entryId, nodeId: p.nodeId, pickedTeamName: p.pickedTeamName },
          })
        )
      )
    }

    return NextResponse.json({
      ok: true,
      filled: newPicksCount,
      total: nodes.length,
      message: newPicksCount > 0
        ? `Auto-filled ${newPicksCount} picks with higher-seeded favorites`
        : "All picks already filled",
    })
  } catch (err) {
    console.error("[bracket/auto-fill] Error:", err)
    return NextResponse.json(
      { error: "Failed to auto-fill bracket" },
      { status: 500 }
    )
  }
}
