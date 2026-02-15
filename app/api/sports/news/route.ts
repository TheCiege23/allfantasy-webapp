import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeTeamAbbrev } from '@/lib/team-abbrev';
import { syncNewsToDb } from './sync-helper';

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/sports/news", tool: "SportsNews" })(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get('team');
    const category = searchParams.get('category');
    const source = searchParams.get('source');
    const refresh = searchParams.get('refresh') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    if (refresh) {
      await syncNewsToDb(team || undefined);
    }

    const where: Record<string, unknown> = {
      sport: 'NFL',
    };

    if (team) {
      where.team = normalizeTeamAbbrev(team) || team;
    }

    if (source) {
      where.source = source;
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    let news = await prisma.sportsNews.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    const stale = news.length === 0 || (news.length > 0 && news[0].expiresAt < new Date());

    if (stale && !refresh) {
      await syncNewsToDb(team || undefined);
      news = await prisma.sportsNews.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: limit,
      });
    }

    const sources = [...new Set(news.map(n => n.source))];

    return NextResponse.json({
      news,
      count: news.length,
      sources,
    });
  } catch (error) {
    console.error('[News API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', details: String(error) },
      { status: 500 }
    );
  }
})
