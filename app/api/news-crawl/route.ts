import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type CrawlItem = {
  id: string;
  type: 'news' | 'injury';
  text: string;
  source?: string;
  url?: string | null;
  team?: string | null;
  timestamp: string;
  priority: number;
};

let espnCache: { items: CrawlItem[]; fetchedAt: number } | null = null;
const ESPN_CACHE_TTL = 180_000;

async function fetchEspnLive(): Promise<CrawlItem[]> {
  if (espnCache && Date.now() - espnCache.fetchedAt < ESPN_CACHE_TTL) {
    return espnCache.items;
  }

  const items: CrawlItem[] = [];

  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=25',
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const articles = data.articles || [];
      for (const a of articles) {
        items.push({
          id: `espn-${a.id || Math.random().toString(36).slice(2)}`,
          type: 'news',
          text: a.headline || a.title || '',
          source: 'ESPN',
          url: a.links?.web?.href || a.links?.api?.news?.href || null,
          team: null,
          timestamp: a.published || new Date().toISOString(),
          priority: 1,
        });
      }
    }
  } catch {
  }

  try {
    const injRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries',
      { signal: AbortSignal.timeout(5000) }
    );
    if (injRes.ok) {
      const injData = await injRes.json();
      const teams = injData.items || [];
      for (const team of teams) {
        const teamName = team.team?.abbreviation || team.team?.shortDisplayName || '';
        const injuries = team.injuries || [];
        for (const cat of injuries) {
          for (const athlete of (cat.entries || [])) {
            const status = athlete.status || '';
            if (['Out', 'Doubtful', 'Questionable', 'IR', 'Injured Reserve'].includes(status)) {
              const name = athlete.athlete?.displayName || athlete.athlete?.fullName || '';
              if (!name) continue;
              const statusEmoji = status === 'Out' || status === 'IR' || status === 'Injured Reserve' ? '🚨' : '⚠️';
              const desc = athlete.details?.type || athlete.details?.detail || '';
              items.push({
                id: `espn-inj-${athlete.athlete?.id || Math.random().toString(36).slice(2)}`,
                type: 'injury',
                text: `${statusEmoji} ${name} (${teamName}) — ${status}${desc ? `: ${desc}` : ''}`,
                source: 'Injury Report',
                team: teamName,
                timestamp: new Date().toISOString(),
                priority: status === 'Out' || status === 'IR' || status === 'Injured Reserve' ? 3 : 2,
              });
            }
          }
        }
      }
    }
  } catch {
  }

  items.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const result = items.slice(0, 30);
  espnCache = { items: result, fetchedAt: Date.now() };
  return result;
}

export const GET = withApiUsage({ endpoint: "/api/news-crawl", tool: "NewsCrawl" })(async () => {
  try {
    const [news, injuries] = await Promise.all([
      prisma.sportsNews.findMany({
        where: {
          sport: 'NFL',
          publishedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
        orderBy: { publishedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          title: true,
          source: true,
          sourceUrl: true,
          team: true,
          publishedAt: true,
          category: true,
        },
      }),
      prisma.sportsInjury.findMany({
        where: {
          sport: 'NFL',
          status: { in: ['Out', 'Doubtful', 'Questionable', 'IR'] },
          updatedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
        orderBy: { updatedAt: 'desc' },
        take: 15,
        select: {
          id: true,
          playerName: true,
          team: true,
          status: true,
          type: true,
          updatedAt: true,
        },
      }),
    ]);

    const items: CrawlItem[] = [];

    for (const n of news) {
      items.push({
        id: n.id,
        type: 'news',
        text: n.title,
        source: n.source === 'espn' ? 'ESPN' : n.category?.split(',')[0]?.trim() || 'News',
        url: n.sourceUrl,
        team: n.team,
        timestamp: n.publishedAt?.toISOString() || '',
        priority: 1,
      });
    }

    for (const inj of injuries) {
      const statusEmoji = inj.status === 'Out' || inj.status === 'IR' ? '🚨' : '⚠️';
      items.push({
        id: inj.id,
        type: 'injury',
        text: `${statusEmoji} ${inj.playerName} (${inj.team}) — ${inj.status}${inj.type ? `: ${inj.type}` : ''}`,
        source: 'Injury Report',
        team: inj.team,
        timestamp: inj.updatedAt?.toISOString() || '',
        priority: inj.status === 'Out' || inj.status === 'IR' ? 3 : 2,
      });
    }

    if (items.length === 0) {
      const liveItems = await fetchEspnLive();
      return NextResponse.json({
        items: liveItems,
        lastUpdated: new Date().toISOString(),
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    items.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return NextResponse.json({
      items: items.slice(0, 30),
      lastUpdated: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[NewsCrawl API] Error:', error);
    try {
      const liveItems = await fetchEspnLive();
      return NextResponse.json({ items: liveItems, lastUpdated: new Date().toISOString() });
    } catch {
      return NextResponse.json({ items: [], lastUpdated: new Date().toISOString() });
    }
  }
})
