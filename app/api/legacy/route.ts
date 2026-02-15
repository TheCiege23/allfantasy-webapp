import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from 'next/server'

export const GET = withApiUsage({ endpoint: "/api/legacy", tool: "Legacy" })(async () => {
  return NextResponse.json({ status: 'coming_soon' })
})
