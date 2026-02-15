import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server"
import { logUsageEvent } from "@/lib/telemetry/usage"

export const POST = withApiUsage({ endpoint: "/api/admin/usage/log", tool: "AdminUsageLog" })(async (req: Request) => {
  const body = await req.json().catch(() => ({}))

  await logUsageEvent({
    scope: "legacy_tool",
    tool: body.tool ? String(body.tool) : "Unknown",
    leagueId: body.leagueId ? String(body.leagueId) : undefined,
    ok: true,
    meta: body.meta ?? null
  })

  return NextResponse.json({ ok: true })
})
