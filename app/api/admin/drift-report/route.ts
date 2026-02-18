import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runDriftDetection, DriftReport } from '@/lib/trade-engine/drift-detection'
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export const dynamic = 'force-dynamic'

export const GET = withApiUsage({ endpoint: "/api/admin/drift-report", tool: "AdminDriftReport" })(async (request: NextRequest) => {
  try {
    if (!isAuthorizedRequest(request)) return adminUnauthorized()

    const season = parseInt(request.nextUrl.searchParams.get('season') || '2025')

    const stats = await prisma.tradeLearningStats.findUnique({
      where: { season },
    })

    const rawStats = stats as Record<string, unknown> | null
    const driftReport = rawStats?.driftReport as unknown as DriftReport | null

    if (!driftReport) {
      return NextResponse.json({
        status: 'no_report',
        message: 'No drift report available yet. Run trade analysis to generate one.',
      })
    }

    return NextResponse.json({
      status: 'ok',
      report: driftReport,
      summary: {
        overallSeverity: driftReport.overallSeverity,
        alertCount: driftReport.alerts.length,
        criticalAlerts: driftReport.alerts.filter(a => a.severity === 'critical').length,
        warnAlerts: driftReport.alerts.filter(a => a.severity === 'warn').length,
        calibrationGap: driftReport.calibration.absoluteGap,
        rankRho: driftReport.rankOrder.spearmanRho,
        segmentCount: driftReport.segments.length,
        inputShifts: driftReport.input.shifts.length,
        lastRun: driftReport.timestamp,
        historyLength: driftReport.history.length,
      },
    })
  } catch (error) {
    console.error('Drift report error:', error)
    return NextResponse.json({ error: 'Failed to fetch drift report' }, { status: 500 })
  }
})

export const POST = withApiUsage({ endpoint: "/api/admin/drift-report", tool: "AdminDriftReport" })(async (request: NextRequest) => {
  try {
    if (!isAuthorizedRequest(request)) return adminUnauthorized()

    const season = parseInt(request.nextUrl.searchParams.get('season') || '2025')

    const report = await runDriftDetection(season)

    return NextResponse.json({
      status: 'ok',
      report,
      summary: {
        overallSeverity: report.overallSeverity,
        alertCount: report.alerts.length,
        criticalAlerts: report.alerts.filter(a => a.severity === 'critical').length,
        warnAlerts: report.alerts.filter(a => a.severity === 'warn').length,
      },
    })
  } catch (error) {
    console.error('Drift detection error:', error)
    return NextResponse.json({ error: 'Failed to run drift detection' }, { status: 500 })
  }
})
