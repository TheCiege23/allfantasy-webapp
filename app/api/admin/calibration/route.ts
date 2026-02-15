import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSessionCookie } from '@/lib/adminSession'
import {
  computeFullDashboard,
  computeFilteredDashboard,
  computeSummaryCards,
  computeDrilldown,
} from '@/lib/trade-engine/calibration-metrics'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

export const GET = withApiUsage({ endpoint: "/api/admin/calibration", tool: "AdminCalibration" })(async (request: NextRequest) => {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const daysBack = parseInt(request.nextUrl.searchParams.get('days') || '30')
    const clampedDays = Math.min(Math.max(daysBack, 1), 365)
    const mode = request.nextUrl.searchParams.get('mode') || undefined
    const segment = request.nextUrl.searchParams.get('segment') || undefined
    const drilldownKey = request.nextUrl.searchParams.get('drilldownKey') || undefined
    const drilldownValue = request.nextUrl.searchParams.get('drilldownValue') || undefined

    if (drilldownKey && drilldownValue) {
      const drilldown = await computeDrilldown(clampedDays, drilldownKey, drilldownValue)
      return NextResponse.json({ drilldown }, {
        headers: { 'Cache-Control': 'no-cache, no-store' },
      })
    }

    const filters = { mode, segment }
    const hasFilters = mode || segment

    const [dashboard, stats] = await Promise.all([
      hasFilters
        ? computeFilteredDashboard(clampedDays, filters)
        : computeFullDashboard(clampedDays),
      prisma.tradeLearningStats.findUnique({ where: { season: 2025 } }),
    ])

    const rawStats = stats as Record<string, unknown> | null

    const recalibration = {
      activeB0: (rawStats?.calibratedB0 as number) ?? -1.10,
      shadowB0: (rawStats?.shadowB0 as number) ?? null,
      shadowB0SampleSize: (rawStats?.shadowB0SampleSize as number) ?? null,
      shadowB0ComputedAt: (rawStats?.shadowB0ComputedAt as string) ?? null,
      shadowB0Metrics: (rawStats?.shadowB0Metrics as Record<string, unknown>) ?? null,
      segmentB0s: (rawStats?.segmentB0s as Record<string, unknown>) ?? null,
      lastRecalibrationAt: (rawStats?.lastRecalibrationAt as string) ?? null,
      calibrationHistory: (rawStats?.calibrationHistory as unknown[]) ?? [],
    }

    const summaryCards = computeSummaryCards(dashboard)

    return NextResponse.json({ ...dashboard, recalibration, summaryCards }, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
    })
  } catch (err) {
    console.error('[admin/calibration] Error:', err)
    return NextResponse.json({ error: 'Failed to compute calibration dashboard' }, { status: 500 })
  }
})
