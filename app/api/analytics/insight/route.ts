import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const POST = withApiUsage({ endpoint: "/api/analytics/insight", tool: "AnalyticsInsight" })(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { event, ...data } = body;

    if (!event) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    await prisma.insightEvent.create({
      data: {
        eventType: event,
        insightId: data.insight_id || null,
        insightType: data.insight_type || null,
        confidenceLevel: data.confidence_level || null,
        confidenceScore: data.confidence_score ? String(data.confidence_score) : null,
        leagueId: data.league_id || null,
        sport: data.sport || null,
        scoringType: data.scoring_type || null,
        dataCoverage: data.data_coverage || null,
        placement: data.placement || null,
        userId: data.user_id || null,
        feedbackType: data.feedback_type || null,
        feedbackText: data.feedback_text || null,
        metadata: data,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log insight event:', error);
    return NextResponse.json({ success: true });
  }
})
