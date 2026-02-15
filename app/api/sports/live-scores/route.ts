import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeTeamAbbrev } from '@/lib/team-abbrev';

export const dynamic = 'force-dynamic';

const LIVE_SCORES_FRESHNESS_MS = 60 * 1000;

interface ESPNCompetitor {
  team: {
    abbreviation: string;
    displayName: string;
    logo: string;
    id: string;
  };
  score: string;
  homeAway: 'home' | 'away';
  winner?: boolean;
  records?: Array<{ summary: string }>;
}

interface ESPNCompetition {
  id: string;
  competitors: ESPNCompetitor[];
  status: {
    type: {
      name: string;
      description: string;
      detail: string;
      shortDetail: string;
      completed: boolean;
    };
    period: number;
    displayClock: string;
  };
  venue?: {
    fullName: string;
    address?: { city: string; state: string };
  };
  odds?: Array<{ details: string; overUnder: number }>;
  broadcasts?: Array<{ names: string[] }>;
  startDate: string;
}

interface ESPNEvent {
  id: string;
  name: string;
  shortName: string;
  date: string;
  season: { year: number; type: number };
  week?: { number: number };
  competitions: ESPNCompetition[];
}

interface LiveScore {
  gameId: string;
  homeTeam: string;
  homeTeamFull: string;
  homeLogo: string;
  homeScore: number;
  homeRecord: string | null;
  awayTeam: string;
  awayTeamFull: string;
  awayLogo: string;
  awayScore: number;
  awayRecord: string | null;
  status: string;
  statusDetail: string;
  period: number;
  clock: string;
  completed: boolean;
  startTime: string;
  venue: string | null;
  broadcast: string | null;
  odds: string | null;
  overUnder: number | null;
  week: number | null;
  season: number;
}

async function fetchESPNLiveScores(): Promise<LiveScore[]> {
  try {
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      { cache: 'no-store' }
    );
    if (!response.ok) return [];

    const data = await response.json();
    const events: ESPNEvent[] = data.events || [];

    return events.map((event) => {
      const comp = event.competitions[0];
      const home = comp.competitors.find((c) => c.homeAway === 'home')!;
      const away = comp.competitors.find((c) => c.homeAway === 'away')!;

      return {
        gameId: event.id,
        homeTeam: normalizeTeamAbbrev(home.team.abbreviation) || home.team.abbreviation,
        homeTeamFull: home.team.displayName,
        homeLogo: home.team.logo,
        homeScore: parseInt(home.score) || 0,
        homeRecord: home.records?.[0]?.summary || null,
        awayTeam: normalizeTeamAbbrev(away.team.abbreviation) || away.team.abbreviation,
        awayTeamFull: away.team.displayName,
        awayLogo: away.team.logo,
        awayScore: parseInt(away.score) || 0,
        awayRecord: away.records?.[0]?.summary || null,
        status: comp.status.type.name,
        statusDetail: comp.status.type.shortDetail,
        period: comp.status.period,
        clock: comp.status.displayClock,
        completed: comp.status.type.completed,
        startTime: comp.startDate || event.date,
        venue: comp.venue?.fullName || null,
        broadcast: comp.broadcasts?.[0]?.names?.join(', ') || null,
        odds: comp.odds?.[0]?.details || null,
        overUnder: comp.odds?.[0]?.overUnder || null,
        week: event.week?.number || null,
        season: event.season.year,
      };
    });
  } catch (error) {
    console.error('[LiveScores] ESPN fetch failed:', error);
    return [];
  }
}

async function syncLiveScoresToDb(scores: LiveScore[]): Promise<number> {
  let synced = 0;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LIVE_SCORES_FRESHNESS_MS * 5);

  for (const score of scores) {
    try {
      await prisma.sportsGame.upsert({
        where: {
          sport_externalId_source: {
            sport: 'NFL',
            externalId: score.gameId,
            source: 'espn_live',
          },
        },
        update: {
          homeTeam: score.homeTeam,
          awayTeam: score.awayTeam,
          homeScore: score.homeScore,
          awayScore: score.awayScore,
          status: score.statusDetail,
          startTime: new Date(score.startTime),
          venue: score.venue,
          week: score.week,
          season: score.season,
          fetchedAt: now,
          expiresAt,
        },
        create: {
          sport: 'NFL',
          externalId: score.gameId,
          homeTeam: score.homeTeam,
          awayTeam: score.awayTeam,
          homeScore: score.homeScore,
          awayScore: score.awayScore,
          status: score.statusDetail,
          startTime: new Date(score.startTime),
          venue: score.venue,
          week: score.week,
          season: score.season,
          source: 'espn_live',
          fetchedAt: now,
          expiresAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[LiveScores] Failed to sync game ${score.gameId}:`, err);
    }
  }

  return synced;
}

export const GET = withApiUsage({ endpoint: "/api/sports/live-scores", tool: "SportsLiveScores" })(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get('team');
    const refresh = searchParams.get('refresh') === 'true';

    const cachedGames = await prisma.sportsGame.findMany({
      where: {
        sport: 'NFL',
        source: 'espn_live',
        ...(team ? { OR: [
          { homeTeam: normalizeTeamAbbrev(team) || team },
          { awayTeam: normalizeTeamAbbrev(team) || team },
        ]} : {}),
      },
      orderBy: { startTime: 'asc' },
    });

    const now = new Date();
    const stale = cachedGames.length === 0 || cachedGames.some(
      (g) => g.fetchedAt && (now.getTime() - g.fetchedAt.getTime()) > LIVE_SCORES_FRESHNESS_MS
    );

    let scores: LiveScore[];
    let refreshed = false;

    if (refresh || stale) {
      scores = await fetchESPNLiveScores();
      await syncLiveScoresToDb(scores);
      refreshed = true;
    } else {
      scores = cachedGames.map((g) => ({
        gameId: g.externalId,
        homeTeam: g.homeTeam,
        homeTeamFull: g.homeTeam,
        homeLogo: '',
        homeScore: g.homeScore ?? 0,
        homeRecord: null,
        awayTeam: g.awayTeam,
        awayTeamFull: g.awayTeam,
        awayLogo: '',
        awayScore: g.awayScore ?? 0,
        awayRecord: null,
        status: g.status ?? 'STATUS_SCHEDULED',
        statusDetail: g.status ?? 'Scheduled',
        period: 0,
        clock: '0:00',
        completed: g.status?.includes('Final') ?? false,
        startTime: g.startTime?.toISOString() ?? '',
        venue: g.venue,
        broadcast: null,
        odds: null,
        overUnder: null,
        week: g.week,
        season: g.season ?? 0,
      }));
    }

    const filteredScores = team
      ? scores.filter((s) => {
          const norm = normalizeTeamAbbrev(team) || team;
          return s.homeTeam === norm || s.awayTeam === norm;
        })
      : scores;

    const hasLiveGames = scores.some(
      (s) => s.status === 'STATUS_IN_PROGRESS' || s.status === 'STATUS_HALFTIME'
    );

    return NextResponse.json({
      scores: filteredScores,
      count: filteredScores.length,
      source: refreshed ? 'espn_live' : 'db_cache',
      refreshed,
      hasLiveGames,
      nextRefreshMs: hasLiveGames ? LIVE_SCORES_FRESHNESS_MS : LIVE_SCORES_FRESHNESS_MS * 5,
      fetchedAt: refreshed ? new Date().toISOString() : (cachedGames[0]?.fetchedAt?.toISOString() || null),
    });
  } catch (error) {
    console.error('[LiveScores] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live scores', details: String(error) },
      { status: 500 }
    );
  }
})
