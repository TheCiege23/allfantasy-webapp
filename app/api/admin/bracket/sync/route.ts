import { NextRequest, NextResponse } from "next/server"
import { withApiUsage } from "@/lib/telemetry/usage"
import { runBracketSync } from "@/lib/bracket-sync"
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export const POST = withApiUsage({
  endpoint: "/api/admin/bracket/sync",
  tool: "BracketSync",
})(async (request: NextRequest) => {
  try {
    if (!isAuthorizedRequest(request)) return adminUnauthorized()

    const { season } = await request.json()

    if (!season || typeof season !== "number") {
      return NextResponse.json({ error: "season (number) is required" }, { status: 400 })
    }

    const result = await runBracketSync(season)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[BracketSync] Error:", err)
    return NextResponse.json(
      { error: err.message || "Bracket sync failed" },
      { status: 500 }
    )
  }
})
