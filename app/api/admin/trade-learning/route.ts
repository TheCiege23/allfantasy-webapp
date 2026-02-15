import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { runBackgroundTradeAnalysis, getLearningContextForAI, aggregateTradeLearningInsights } from '@/lib/trade-learning';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const POST = withApiUsage({ endpoint: "/api/admin/trade-learning", tool: "AdminTradeLearning" })(async (request: NextRequest) => {
  try {
    const authHeader = request.headers.get('authorization');
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runBackgroundTradeAnalysis();
    
    return NextResponse.json({
      success: true,
      processed: result.processed,
      aggregated: result.aggregated,
      calibrated: result.calibrated,
      driftDetected: result.driftDetected,
      message: `Analyzed ${result.processed} trades${result.aggregated ? ' and updated aggregated insights' : ''}${result.driftDetected ? ' [DRIFT DETECTED]' : ''}`,
    });
  } catch (error) {
    console.error('Trade learning error:', error);
    return NextResponse.json(
      { error: 'Failed to run trade analysis' },
      { status: 500 }
    );
  }
})

export const GET = withApiUsage({ endpoint: "/api/admin/trade-learning", tool: "AdminTradeLearning" })(async (request: NextRequest) => {
  try {
    const season = parseInt(request.nextUrl.searchParams.get('season') || '2025');
    
    const stats = await prisma.tradeLearningStats.findUnique({
      where: { season },
    });

    const insights = await prisma.tradeLearningInsight.findMany({
      where: { season },
      orderBy: { sampleSize: 'desc' },
      take: 50,
    });

    const unanalyzedCount = await prisma.leagueTrade.count({
      where: { analyzed: false, season: { gte: 2024 } },
    });

    const learningContext = await getLearningContextForAI(season);

    return NextResponse.json({
      stats,
      insights,
      unanalyzedCount,
      learningContextPreview: learningContext.slice(0, 2000),
    });
  } catch (error) {
    console.error('Trade learning stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade learning stats' },
      { status: 500 }
    );
  }
})
