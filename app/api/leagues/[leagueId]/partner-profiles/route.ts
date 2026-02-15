import { NextResponse } from "next/server"
import { buildPartnerProfiles } from "@/lib/rankings-engine/partner-profiles"
import { withApiUsage } from "@/lib/telemetry/usage"

export const GET = withApiUsage({
  endpoint: "/api/leagues/[leagueId]/partner-profiles",
  tool: "PartnerProfiles"
})(async (req: Request, ctx: { params: { leagueId: string } }) => {
  const { leagueId } = ctx.params
  const url = new URL(req.url)
  const week = Number(url.searchParams.get("week") ?? 0)

  if (!leagueId || !week) {
    return NextResponse.json({ error: "Missing leagueId or week" }, { status: 400 })
  }

  try {
    const data = await buildPartnerProfiles({ leagueId, week })
    return NextResponse.json(data)
  } catch (err: any) {
    console.error("[Partner Profiles API]", err?.message)
    return NextResponse.json({ error: "Failed to compute partner profiles" }, { status: 500 })
  }
})
