import { NextResponse } from "next/server"
import { buildLDIHeatmap } from "@/lib/rankings-engine/ldi-heatmap"
import { withApiUsage } from "@/lib/telemetry/usage"
import { hardenLdiResponse } from "@/lib/ldi/harden-ldi"

export const GET = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/ldi-heatmap",
  tool: "LDIHeatmap"
})(async (req: Request, ctx: { params: { leagueId: string } }) => {
  const { leagueId } = ctx.params
  const url = new URL(req.url)
  const week = Number(url.searchParams.get("week") ?? 0)

  if (!leagueId || !week) {
    return NextResponse.json({ error: "Missing leagueId or week" }, { status: 400 })
  }

  try {
    const data = await buildLDIHeatmap({ leagueId, week })

    const now = new Date()
    const month = now.getMonth()
    const isOffseason = month >= 2 && month <= 8

    const hardened = hardenLdiResponse({
      raw: data,
      leagueId,
      leagueName: (data as any)?.leagueName,
      season: (data as any)?.season ? Number((data as any).season) : undefined,
      week,
      isOffseason,
    })

    return NextResponse.json({
      ...hardened,
      ...data,
      fallbackMode: hardened.fallbackMode,
      ldiByPos: hardened.ldiByPos,
      positionDemandNorm: hardened.positionDemandNorm,
      rankingSource: hardened.rankingSource,
      rankingSourceNote: hardened.rankingSourceNote,
      warnings: hardened.warnings,
      isOffseason: hardened.isOffseason,
      tradesAnalyzed: hardened.tradesAnalyzed,
    })
  } catch (err: any) {
    console.error("[LDI Heatmap API]", err?.message)
    return NextResponse.json({ error: "Failed to compute heatmap" }, { status: 500 })
  }
})
