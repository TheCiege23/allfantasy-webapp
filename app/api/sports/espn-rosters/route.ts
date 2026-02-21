import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { syncESPNRostersToDb } from '@/lib/espn-data';

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/sports/espn-rosters", tool: "ESPNRosters" })(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get('team');

    const result = await syncESPNRostersToDb(team ? [team.toUpperCase()] : undefined);

    return NextResponse.json({
      ...result,
      source: 'espn',
      ok: true,
    });
  } catch (error) {
    console.error('[ESPN Rosters] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync ESPN rosters', details: String(error) },
      { status: 500 }
    );
  }
})
