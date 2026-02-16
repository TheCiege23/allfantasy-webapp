import { NextResponse } from "next/server"
import { rebuildHallOfFame, getHallOfFame, getSeasonLeaderboard } from "@/lib/rankings-engine/hall-of-fame"
import { withApiUsage } from "@/lib/telemetry/usage"
import { buildBaselineMeta, ensureArray } from "@/lib/engine/response-guard"

export const GET = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/hall-of-fame",
  tool: "HallOfFame"
})(async (req: Request, ctx: { params: { leagueId: string } }) => {
  try {
    const { leagueId } = ctx.params
    const url = new URL(req.url)
    const season = url.searchParams.get("season")

    if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 })

    if (season) {
      const rows = await getSeasonLeaderboard({ leagueId, season: String(season) })
      if (!rows || rows.length === 0) {
        return NextResponse.json({
          leagueId,
          season,
          rows: [],
          meta: buildBaselineMeta(
            "no_season_results",
            "No completed seasons recorded yet. Hall of Fame will populate automatically."
          ),
        })
      }
      return NextResponse.json({ leagueId, season, rows: ensureArray(rows) })
    }

    const rows = await getHallOfFame({ leagueId })
    if (!rows || rows.length === 0) {
      return NextResponse.json({
        leagueId,
        rows: [],
        meta: buildBaselineMeta(
          "no_season_results",
          "No completed seasons recorded yet. Hall of Fame will populate automatically."
        ),
      })
    }
    return NextResponse.json({ leagueId, rows: ensureArray(rows) })
  } catch (e) {
    console.error("[HallOfFame GET]", e instanceof Error ? e.message : e)
    return NextResponse.json({
      leagueId: ctx.params.leagueId,
      rows: [],
      meta: buildBaselineMeta("error", "Unable to load Hall of Fame at this time."),
    })
  }
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
