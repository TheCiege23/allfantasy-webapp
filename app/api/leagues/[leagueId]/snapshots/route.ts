import { NextResponse } from "next/server"
import { saveRankingsSnapshot } from "@/lib/rankings-engine/snapshots"
import { getV2Rankings } from "@/lib/rankings-engine/v2-adapter"
import { withApiUsage } from "@/lib/telemetry/usage"

export const POST = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/snapshots",
  tool: "Snapshots"
})(async (req: Request, ctx: { params: { leagueId: string } }) => {
  const { leagueId } = ctx.params
  const body = await req.json().catch(() => ({}))
  const week = Number(body.week ?? 0)

  if (!leagueId || !week) {
    return NextResponse.json({ error: "Missing leagueId or week" }, { status: 400 })
  }

  try {
    const v2 = await getV2Rankings({ leagueId, week })

    await saveRankingsSnapshot({
      leagueId,
      season: v2.season,
      week: v2.week,
      teams: v2.teams.map((t: any) => ({
        rosterId: t.rosterId,
        rank: t.rank,
        composite: Number(t.composite ?? 0),
        expectedWins: t.expectedWins ?? null,
        luckDelta: t.luckDelta ?? null
      }))
    })

    return NextResponse.json({ ok: true, season: v2.season, week: v2.week })
  } catch (err: any) {
    console.error("[Snapshots API]", err?.message)
    return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 })
  }
})
