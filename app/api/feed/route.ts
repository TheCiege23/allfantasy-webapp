import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get("scope") || "global"
    const tournamentId = searchParams.get("tournamentId")
    const leagueId = searchParams.get("leagueId")
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)))

    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId is required" }, { status: 400 })
    }

    const where: any = { tournamentId }

    if (scope === "league" && leagueId) {
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
      { ok: true, events },
      { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } }
    )
  } catch (err: any) {
    console.error("[api/feed] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch feed" }, { status: 500 })
  }
}
