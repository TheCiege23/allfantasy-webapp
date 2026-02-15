import { NextResponse } from "next/server"
import { getRankHistory } from "@/lib/rankings-engine/snapshots"
import { withApiUsage } from "@/lib/telemetry/usage"

export const GET = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/rank-history",
  tool: "RankHistory"
})(async (req: Request, ctx: { params: { leagueId: string } }) => {
  const { leagueId } = ctx.params
  const url = new URL(req.url)
  const rosterId = String(url.searchParams.get("rosterId") ?? "")
  const limit = Number(url.searchParams.get("limit") ?? 12)

  if (!leagueId || !rosterId) {
    return NextResponse.json({ error: "Missing leagueId or rosterId" }, { status: 400 })
  }

  try {
    const rows = await getRankHistory({ leagueId, rosterId, limit })
    return NextResponse.json({ leagueId, rosterId, rows })
  } catch (err: any) {
    console.error("[Rank History API]", err?.message)
    return NextResponse.json({ error: "Failed to fetch rank history" }, { status: 500 })
  }
})
