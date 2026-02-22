import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const scope = (url.searchParams.get("scope") ?? "global") as "global" | "league"
    const tournamentId = url.searchParams.get("tournamentId")
    const leagueId = url.searchParams.get("leagueId")
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "30", 10)))

    if (!tournamentId) {
      return NextResponse.json({ error: "Missing tournamentId" }, { status: 400 })
    }

    const where: any = { tournamentId }

    if (scope === "league") {
      if (!leagueId) {
        return NextResponse.json({ error: "Missing leagueId" }, { status: 400 })
      }
      where.leagueId = leagueId
    } else {
      where.leagueId = null
    }

    const rows = await (prisma as any).bracketFeedEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    const events = rows.map((r: any) => ({
      id: r.id,
      scope: r.leagueId ? "league" : "global",
      leagueId: r.leagueId,
      tournamentId: r.tournamentId,
      gameId: (r.metadata as any)?.gameId ?? null,
      type: r.eventType,
      title: r.headline,
      message: r.detail ?? "",
      impactPct: (r.metadata as any)?.impactPct ?? null,
      createdAt: r.createdAt,
    }))

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } }
    )
  } catch (err: any) {
    console.error("[api/feed] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch feed" }, { status: 500 })
  }
}
