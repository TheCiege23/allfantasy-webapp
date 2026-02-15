import { NextResponse } from "next/server"
import { rebuildHallOfFame, getHallOfFame, getSeasonLeaderboard } from "@/lib/rankings-engine/hall-of-fame"
import { withApiUsage } from "@/lib/telemetry/usage"

export const GET = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/hall-of-fame",
  tool: "HallOfFame"
})(async (req: Request, ctx: { params: { leagueId: string } }) => {
  const { leagueId } = ctx.params
  const url = new URL(req.url)
  const season = url.searchParams.get("season")

  if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 })

  if (season) {
    const rows = await getSeasonLeaderboard({ leagueId, season: String(season) })
    return NextResponse.json({ leagueId, season, rows })
  }

  const rows = await getHallOfFame({ leagueId })
  return NextResponse.json({ leagueId, rows })
})

export const POST = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/hall-of-fame",
  tool: "HallOfFame"
})(async (_: Request, ctx: { params: { leagueId: string } }) => {
  const { leagueId } = ctx.params
  if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 })

  const result = await rebuildHallOfFame({ leagueId })
  return NextResponse.json(result)
})
