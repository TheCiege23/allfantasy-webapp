import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { getSportsData, getTeams, getGames, getStandings, Sport, DataType } from '@/lib/sports-router';

export const GET = withApiUsage({ endpoint: "/api/sports", tool: "Sports" })(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const sport = searchParams.get('sport')?.toUpperCase() as Sport;
  const dataType = searchParams.get('type') as DataType;
  const identifier = searchParams.get('id') || undefined;
  const forceRefresh = searchParams.get('refresh') === 'true';

  if (!sport) {
    return NextResponse.json(
      { error: 'Missing sport parameter', validSports: ['NFL', 'NBA', 'MLB', 'NHL', 'MLS', 'NCAAB', 'CFB'] },
      { status: 400 }
    );
  }

  if (!dataType) {
    return NextResponse.json(
      { error: 'Missing type parameter', validTypes: ['teams', 'players', 'games', 'stats', 'standings', 'schedule'] },
      { status: 400 }
    );
  }

  const validSports = ['NFL', 'NBA', 'MLB', 'NHL', 'MLS', 'NCAAB', 'CFB'];
  if (!validSports.includes(sport)) {
    return NextResponse.json(
      { error: `Invalid sport: ${sport}`, validSports },
      { status: 400 }
    );
  }

  try {
    const result = await getSportsData({
      sport,
      dataType,
      identifier,
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      sport,
      dataType,
      source: result.source,
      cached: result.cached,
      fetchedAt: result.fetchedAt.toISOString(),
      data: result.data,
    });
  } catch (error) {
    console.error('Sports data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sports data', details: String(error) },
      { status: 500 }
    );
  }
})

export const POST = withApiUsage({ endpoint: "/api/sports", tool: "Sports" })(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { sport, dataType, identifier, forceRefresh } = body;

    if (!sport || !dataType) {
      return NextResponse.json(
        { error: 'Missing sport or dataType in request body' },
        { status: 400 }
      );
    }

    const result = await getSportsData({
      sport: sport.toUpperCase() as Sport,
      dataType: dataType as DataType,
      identifier,
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      sport: sport.toUpperCase(),
      dataType,
      source: result.source,
      cached: result.cached,
      fetchedAt: result.fetchedAt.toISOString(),
      data: result.data,
    });
  } catch (error) {
    console.error('Sports data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sports data', details: String(error) },
      { status: 500 }
    );
  }
})
