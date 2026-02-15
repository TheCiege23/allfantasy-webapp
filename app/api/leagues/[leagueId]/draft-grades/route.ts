import { NextResponse } from "next/server"
import { computeDraftGrades, upsertDraftGrades, getDraftGrades } from "@/lib/rankings-engine/draft-grades"
import { withApiUsage } from "@/lib/telemetry/usage"

export const GET = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/draft-grades",
  tool: "DraftGrades"
})(async (req: Request, ctx: { params: { leagueId: string } }) => {
  const { leagueId } = ctx.params
  const url = new URL(req.url)
  const season = String(url.searchParams.get("season") ?? "")

  if (!leagueId || !season) {
    return NextResponse.json({ error: "Missing leagueId or season" }, { status: 400 })
  }

  const rows = await getDraftGrades({ leagueId, season })
  return NextResponse.json({ leagueId, season, rows })
})

export const POST = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/draft-grades",
  tool: "DraftGrades"
})(async (req: Request, ctx: { params: { leagueId: string } }) => {
  const { leagueId } = ctx.params
  const body = await req.json().catch(() => ({}))
  const week = Number(body.week ?? 0)

  if (!leagueId || !week) {
    return NextResponse.json({ error: "Missing leagueId or week" }, { status: 400 })
  }

  const computed = await computeDraftGrades({ leagueId, week })

  if (!computed.grades?.length) {
    return NextResponse.json(computed)
  }

  await upsertDraftGrades({
    leagueId,
    season: computed.season,
    grades: computed.grades.map((g: any) => ({
      rosterId: g.rosterId,
      grade: g.grade,
      score: g.score,
      breakdown: g.breakdown
    }))
  })

  return NextResponse.json({ ok: true, leagueId, season: computed.season, count: computed.grades.length })
})
