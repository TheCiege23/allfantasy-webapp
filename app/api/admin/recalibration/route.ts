import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSessionCookie } from '@/lib/adminSession'
import { runWeeklyRecalibration } from '@/lib/trade-engine/auto-recalibration'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const adminPassword = process.env.ADMIN_PASSWORD
  if (adminPassword && authHeader === `Bearer ${adminPassword}`) return true

  const cookieStore = cookies()
  const adminSession = cookieStore.get('admin_session')
  if (adminSession?.value) {
    const payload = verifyAdminSessionCookie(adminSession.value)
    if (payload) return true
  }

  return false
}

export const POST = withApiUsage({ endpoint: "/api/admin/recalibration", tool: "AdminRecalibration" })(async (request: NextRequest) => {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
