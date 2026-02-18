import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import {
  runWeeklyLearningAllSegments,
  runWeeklyLearningForSegment,
  getActiveWeightsForSegment,
  getWeightHistory,
  SEGMENT_KEYS,
} from '@/lib/rankings-engine/weekly-weight-learning'
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export const POST = withApiUsage({ endpoint: "/api/admin/weekly-weights", tool: "AdminWeeklyWeights" })(async (req: NextRequest) => {
  if (!isAuthorizedRequest(req)) return adminUnauthorized()

  try {
    const body = await req.json().catch(() => ({}))
    const segment = body.segment as string | undefined
    const forceDate = body.forceDate ? new Date(body.forceDate) : undefined

    if (segment) {
      const result = await runWeeklyLearningForSegment(segment, forceDate)
      return NextResponse.json({ results: [result] })
    }

    const results = await runWeeklyLearningAllSegments(forceDate)
    return NextResponse.json({ results })
  } catch (err: any) {
    console.error('[WeeklyWeights API]', err?.message)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
})

export const GET = withApiUsage({ endpoint: "/api/admin/weekly-weights", tool: "AdminWeeklyWeights" })(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const segment = sp.get('segment')

  if (segment) {
    const [active, history] = await Promise.all([
      getActiveWeightsForSegment(segment),
      getWeightHistory(segment),
    ])
    return NextResponse.json({ segment, active, history })
  }

  const allActive: Record<string, any> = {}
  for (const seg of SEGMENT_KEYS) {
    allActive[seg] = await getActiveWeightsForSegment(seg)
  }
  return NextResponse.json({ segments: allActive })
})
