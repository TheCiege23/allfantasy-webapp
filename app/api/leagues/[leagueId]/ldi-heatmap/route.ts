import { NextResponse } from "next/server"
import { buildLDIHeatmap } from "@/lib/rankings-engine/ldi-heatmap"
import { withApiUsage } from "@/lib/telemetry/usage"

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
    return NextResponse.json(data)
  } catch (err: any) {
    console.error("[LDI Heatmap API]", err?.message)
    return NextResponse.json({ error: "Failed to compute heatmap" }, { status: 500 })
  }
})
