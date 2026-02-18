import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyRecalibration } from '@/lib/trade-engine/auto-recalibration'
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = withApiUsage({ endpoint: "/api/admin/recalibration", tool: "AdminRecalibration" })(async (request: NextRequest) => {
  try {
    if (!isAuthorizedRequest(request)) return adminUnauthorized()

    const body = await request.json().catch(() => ({}))
    const season = body.season || 2025

    const result = await runWeeklyRecalibration(season)

    return NextResponse.json({
      success: true,
      ...result,
    }, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
    })
  } catch (err) {
    console.error('[admin/recalibration] Error:', err)
    return NextResponse.json({ error: 'Recalibration failed' }, { status: 500 })
  }
})
