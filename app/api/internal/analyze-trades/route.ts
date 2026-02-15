import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { runBackgroundTradeAnalysis } from '@/lib/trade-learning';

export const POST = withApiUsage({ endpoint: "/api/internal/analyze-trades", tool: "InternalAnalyzeTrades" })(async (request: NextRequest) => {
  try {
    const authHeader = request.headers.get('x-internal-key');
    const internalKey = process.env.SESSION_SECRET;
    
    if (!internalKey || authHeader !== internalKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runBackgroundTradeAnalysis();
    
    return NextResponse.json({
      success: true,
      processed: result.processed,
      aggregated: result.aggregated,
    });
  } catch (error) {
    console.error('Internal trade analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run trade analysis' },
      { status: 500 }
    );
  }
})
