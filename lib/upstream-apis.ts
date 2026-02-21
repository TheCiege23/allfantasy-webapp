import type { PrismaClient } from '@prisma/client';
import type { FantasyCalcPlayer, FantasyCalcSettings } from './fantasycalc';
import { readCache, writeCache } from './enrichment-cache';

export interface UpstreamDeps {
  prisma: PrismaClient;
  newsApiKey?: string;
}

export interface NewsContextItem {
  id: string;
  title: string;
  source: string;
  url: string | null;
  team: string | null;
  publishedAt: string;
  isInjury: boolean;
  injuryStatus?: string | null;
  playerName?: string | null;
  relevance: 'direct' | 'team' | 'league' | 'general';
}

export interface NewsContextResult {
  items: NewsContextItem[];
  fetchedAt: string;
  sources: string[];
  playerHits: number;
  teamHits: number;
}

export async function fetchNewsContext(
  deps: UpstreamDeps,
  params: {
    playerNames?: string[];
    teamAbbrevs?: string[];
    leagueId?: string;
    sport?: string;
    hoursBack?: number;
    limit?: number;
    skipCache?: boolean;
  }
): Promise<NewsContextResult> {
  const {
    playerNames = [],
    teamAbbrevs = [],
    sport = 'NFL',
    hoursBack = 72,
    limit = 20,
    skipCache = false,
  } = params;

  if (!skipCache) {
    const cacheParams = { playerNames: playerNames.slice(0, 15).sort(), teamAbbrevs: [...teamAbbrevs].sort(), sport, hoursBack };
    const cached = await readCache<NewsContextResult>(deps.prisma, 'news_context', cacheParams);
    if (cached) {
      return { ...cached.data, fetchedAt: cached.fetchedAt };
    }
  }

  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const items: NewsContextItem[] = [];
  const sources = new Set<string>();
  let playerHits = 0;
  let teamHits = 0;

  let newsItemCount = 0;

  const dateFilter = {
    OR: [
      { publishedAt: { gte: since } },
      { publishedAt: null, createdAt: { gte: since } },
    ],
  };

  const entityFilters: any[] = [];
  if (playerNames.length > 0) {
    for (const name of playerNames) {
      entityFilters.push({ title: { contains: name, mode: 'insensitive' as const } });
    }
  }
  if (teamAbbrevs.length > 0) {
    entityFilters.push({ team: { in: teamAbbrevs } });
  }

  const dbWhere: any = {
    sport,
    AND: [
      dateFilter,
      ...(entityFilters.length > 0 ? [{ OR: entityFilters }] : []),
    ],
  };

  try {
    const newsRows = await deps.prisma.sportsNews.findMany({
      where: dbWhere,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        source: true,
        sourceUrl: true,
        team: true,
        publishedAt: true,
      },
    });

    for (const row of newsRows) {
      const lowerTitle = row.title.toLowerCase();
      let relevance: NewsContextItem['relevance'] = 'general';

      const matchedPlayer = playerNames.find(
        (n) => lowerTitle.includes(n.toLowerCase())
      );
      if (matchedPlayer) {
        relevance = 'direct';
        playerHits++;
      } else if (row.team && teamAbbrevs.includes(row.team)) {
        relevance = 'team';
        teamHits++;
      } else if (teamAbbrevs.length > 0 || playerNames.length > 0) {
        relevance = 'league';
      }

      sources.add(row.source || 'unknown');
      newsItemCount++;
      items.push({
        id: row.id,
        title: row.title,
        source: row.source || 'unknown',
        url: row.sourceUrl,
        team: row.team,
        publishedAt: row.publishedAt?.toISOString() || '',
        isInjury: false,
        relevance,
      });
    }
  } catch (err) {
    console.warn('[UpstreamAPIs] DB news fetch failed:', err);
  }

  try {
    const injWhere: any = {
      sport,
      status: { not: 'Active' },
      updatedAt: { gte: since },
    };

    const injOr: any[] = [];
    if (playerNames.length > 0) {
      for (const name of playerNames) {
        injOr.push({ playerName: { equals: name, mode: 'insensitive' as const } });
      }
    }
    if (teamAbbrevs.length > 0) {
      injOr.push({ team: { in: teamAbbrevs } });
    }
    if (injOr.length > 0) {
      injWhere.OR = injOr;
    }

    const injuries = await deps.prisma.sportsInjury.findMany({
      where: injWhere,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limit, 15),
      select: {
        id: true,
        playerName: true,
        team: true,
        status: true,
        type: true,
        updatedAt: true,
      },
    });

    for (const inj of injuries) {
      const isDirectHit = playerNames.some(
        (n) => n.toLowerCase() === inj.playerName.toLowerCase()
      );
      if (isDirectHit) playerHits++;
      else if (inj.team && teamAbbrevs.includes(inj.team)) teamHits++;

      sources.add('injury_report');
      items.push({
        id: inj.id,
        title: `${inj.playerName} (${inj.team || '?'}) — ${inj.status}${inj.type ? `: ${inj.type}` : ''}`,
        source: 'injury_report',
        url: null,
        team: inj.team,
        publishedAt: inj.updatedAt?.toISOString() || '',
        isInjury: true,
        injuryStatus: inj.status,
        playerName: inj.playerName,
        relevance: isDirectHit ? 'direct' : 'team',
      });
    }
  } catch (err) {
    console.warn('[UpstreamAPIs] DB injury fetch failed:', err);
  }

  if (newsItemCount === 0 && deps.newsApiKey) {
    try {
      const headlinesUrl = `https://newsapi.org/v2/top-headlines?country=us&category=sports&pageSize=${limit}&apiKey=${deps.newsApiKey}`;
      const headlinesRes = await fetch(headlinesUrl, { signal: AbortSignal.timeout(5000) });
      if (headlinesRes.ok) {
        const data = await headlinesRes.json();
        for (const article of (data.articles || [])) {
          if (!article.title || article.title === '[Removed]') continue;
          const titleLower = (article.title || '').toLowerCase();
          const isNflRelated = titleLower.includes('nfl') || titleLower.includes('football') ||
            playerNames.some(n => titleLower.includes(n.toLowerCase())) ||
            teamAbbrevs.some(t => titleLower.includes(t.toLowerCase()));
          if (!isNflRelated && playerNames.length > 0) continue;

          sources.add('newsapi_headlines');
          items.push({
            id: `newsapi-hl-${article.url || Math.random().toString(36).slice(2)}`,
            title: article.title || '',
            source: article.source?.name || 'NewsAPI Headlines',
            url: article.url || null,
            team: null,
            publishedAt: article.publishedAt || new Date().toISOString(),
            isInjury: false,
            relevance: 'general',
          });
        }
      }
    } catch {
    }

    try {
      const q = playerNames.length > 0
        ? playerNames.slice(0, 3).join(' OR ')
        : teamAbbrevs.length > 0
          ? teamAbbrevs.slice(0, 5).join(' OR ') + ' NFL'
          : 'NFL fantasy football';

      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=${limit}&language=en&apiKey=${deps.newsApiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (res.ok) {
        const data = await res.json();
        for (const article of (data.articles || [])) {
          if (!article.title || article.title === '[Removed]') continue;
          sources.add('newsapi');
          items.push({
            id: `newsapi-${article.url || Math.random().toString(36).slice(2)}`,
            title: article.title || '',
            source: article.source?.name || 'NewsAPI',
            url: article.url || null,
            team: null,
            publishedAt: article.publishedAt || new Date().toISOString(),
            isInjury: false,
            relevance: 'general',
          });
        }
      }
    } catch {
    }
  }

  if (newsItemCount === 0) {
    try {
      const espnRes = await fetch(
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=15',
        { signal: AbortSignal.timeout(5000) }
      );
      if (espnRes.ok) {
        const data = await espnRes.json();
        for (const a of (data.articles || [])) {
          sources.add('espn');
          items.push({
            id: `espn-${a.id || Math.random().toString(36).slice(2)}`,
            title: a.headline || a.title || '',
            source: 'ESPN',
            url: a.links?.web?.href || null,
            team: null,
            publishedAt: a.published || new Date().toISOString(),
            isInjury: false,
            relevance: 'general',
          });
        }
      }
    } catch {
    }
  }

  items.sort((a, b) => {
    const relOrder: Record<string, number> = { direct: 3, team: 2, league: 1, general: 0 };
    const rDiff = (relOrder[b.relevance] || 0) - (relOrder[a.relevance] || 0);
    if (rDiff !== 0) return rDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const result: NewsContextResult = {
    items: items.slice(0, limit),
    fetchedAt: new Date().toISOString(),
    sources: Array.from(sources),
    playerHits,
    teamHits,
  };

  if (!skipCache && result.items.length > 0) {
    const cacheParams = { playerNames: playerNames.slice(0, 15).sort(), teamAbbrevs: [...teamAbbrevs].sort(), sport, hoursBack };
    writeCache(deps.prisma, 'news_context', cacheParams, result, 'news').catch(() => {});
  }

  return result;
}

export interface RollingInsightsPlayerContext {
  playerId: string;
  name: string;
  team: string | null;
  position: string | null;
  status: string | null;
  age: string | null;
  fantasyPointsPerGame: number | null;
  gamesPlayed: number | null;
  seasonStats: Record<string, unknown> | null;
}

export interface RollingInsightsTeamContext {
  teamId: string;
  name: string;
  abbrev: string;
  mascot: string;
  playerCount: number;
}

export interface RollingInsightsResult {
  players: RollingInsightsPlayerContext[];
  teams: RollingInsightsTeamContext[];
  fetchedAt: string;
  source: 'db_cache' | 'live_api';
}

export async function fetchRollingInsights(
  deps: UpstreamDeps,
  params: {
    playerNames?: string[];
    teamAbbrevs?: string[];
    sport?: string;
    includeStats?: boolean;
    skipCache?: boolean;
  }
): Promise<RollingInsightsResult> {
  const {
    playerNames = [],
    teamAbbrevs = [],
    sport = 'NFL',
    includeStats = true,
    skipCache = false,
  } = params;

  if (!skipCache) {
    const cacheParams = { playerNames: [...playerNames].sort(), teamAbbrevs: [...teamAbbrevs].sort(), sport };
    const cached = await readCache<RollingInsightsResult>(deps.prisma, 'rolling_insights', cacheParams);
    if (cached) {
      return { ...cached.data, fetchedAt: cached.fetchedAt };
    }
  }

  const players: RollingInsightsPlayerContext[] = [];
  const teams: RollingInsightsTeamContext[] = [];
  let source: 'db_cache' | 'live_api' = 'db_cache';

  if (playerNames.length > 0) {
    try {
      const dbPlayers = await deps.prisma.sportsPlayer.findMany({
        where: {
          sport,
          source: 'rolling_insights',
          OR: playerNames.map((n) => ({
            name: { equals: n, mode: 'insensitive' as const },
          })),
        },
        take: playerNames.length + 5,
        select: {
          externalId: true,
          name: true,
          team: true,
          position: true,
          status: true,
          dob: true,
        },
      });

      for (const p of dbPlayers) {
        let seasonStats: Record<string, unknown> | null = null;
        let fpg: number | null = null;
        let gp: number | null = null;

        if (includeStats) {
          const stat = await deps.prisma.playerSeasonStats.findFirst({
            where: {
              sport,
              playerId: p.externalId,
              source: 'rolling_insights',
              seasonType: 'regular',
            },
            orderBy: { season: 'desc' },
          });
          if (stat) {
            seasonStats = stat.stats as Record<string, unknown>;
            fpg = stat.fantasyPointsPerGame ?? null;
            gp = stat.gamesPlayed ?? null;
          }
        }

        players.push({
          playerId: p.externalId,
          name: p.name,
          team: p.team,
          position: p.position,
          status: p.status,
          age: p.dob,
          fantasyPointsPerGame: fpg,
          gamesPlayed: gp,
          seasonStats,
        });
      }

      if (players.length === 0 && process.env.ROLLING_INSIGHTS_CLIENT_ID) {
        source = 'live_api';
        const { searchNFLPlayer } = await import('./rolling-insights');
        for (const name of playerNames.slice(0, 5)) {
          try {
            const results = await searchNFLPlayer(name);
            for (const r of results.slice(0, 1)) {
              const latestStats = r.regularSeason?.[r.regularSeason.length - 1] || null;
              players.push({
                playerId: r.id,
                name: r.player,
                team: r.team?.abbrv || null,
                position: r.position,
                status: r.status,
                age: r.dob,
                fantasyPointsPerGame: latestStats?.DK_fantasy_points_per_game ?? null,
                gamesPlayed: latestStats?.games_played ?? null,
                seasonStats: latestStats as unknown as Record<string, unknown>,
              });
            }
          } catch {
          }
        }
      }
    } catch (err) {
      console.warn('[UpstreamAPIs] Rolling Insights player fetch failed:', err);
    }
  }

  if (teamAbbrevs.length > 0) {
    try {
      const dbTeams = await deps.prisma.sportsTeam.findMany({
        where: {
          sport,
          source: 'rolling_insights',
          shortName: { in: teamAbbrevs },
        },
        select: {
          externalId: true,
          name: true,
          shortName: true,
        },
      });

      for (const t of dbTeams) {
        const playerCount = await deps.prisma.sportsPlayer.count({
          where: { sport, team: t.shortName, source: 'rolling_insights' },
        });

        teams.push({
          teamId: t.externalId,
          name: t.name,
          abbrev: t.shortName || '',
          mascot: t.name.split(' ').pop() || '',
          playerCount,
        });
      }
    } catch (err) {
      console.warn('[UpstreamAPIs] Rolling Insights team fetch failed:', err);
    }
  }

  const result: RollingInsightsResult = {
    players,
    teams,
    fetchedAt: new Date().toISOString(),
    source,
  };

  if (!skipCache && (players.length > 0 || teams.length > 0)) {
    const cacheParams = { playerNames: [...playerNames].sort(), teamAbbrevs: [...teamAbbrevs].sort(), sport };
    writeCache(deps.prisma, 'rolling_insights', cacheParams, result, 'rolling_insights').catch(() => {});
  }

  return result;
}

export interface CrossSportSignal {
  entity: string;
  sport: string;
  signalType: 'coaching_change' | 'draft_capital' | 'market_trend' | 'venue_overlap' | 'injury_pattern';
  headline: string;
  relevance: number;
  data: Record<string, unknown>;
}

export interface CrossSportResult {
  signals: CrossSportSignal[];
  enabled: boolean;
  fetchedAt: string;
}

export async function fetchCrossSportSignals(
  deps: UpstreamDeps,
  params: {
    entities: Array<{ name: string; type: 'player' | 'team'; sport?: string }>;
    enabled?: boolean;
  }
): Promise<CrossSportResult> {
  const { entities, enabled = false } = params;

  if (!enabled || entities.length === 0) {
    return { signals: [], enabled: false, fetchedAt: new Date().toISOString() };
  }

  const signals: CrossSportSignal[] = [];

  const teamEntities = entities.filter((e) => e.type === 'team');

  for (const entity of teamEntities) {
    try {
      const sharedVenue = await deps.prisma.sportsGame.findMany({
        where: {
          venue: { not: null },
          OR: [
            { homeTeam: { contains: entity.name, mode: 'insensitive' } },
            { awayTeam: { contains: entity.name, mode: 'insensitive' } },
          ],
        },
        select: { venue: true, sport: true, homeTeam: true },
        distinct: ['venue'],
        take: 3,
      });

      if (sharedVenue.length > 1) {
        const sports = [...new Set(sharedVenue.map((g) => g.sport))];
        if (sports.length > 1) {
          signals.push({
            entity: entity.name,
            sport: entity.sport || 'NFL',
            signalType: 'venue_overlap',
            headline: `${entity.name} shares venue across ${sports.join(', ')} — travel/scheduling impact possible`,
            relevance: 0.3,
            data: { venues: sharedVenue.map((v) => v.venue), sports },
          });
        }
      }
    } catch {
    }
  }

  const playerEntities = entities.filter((e) => e.type === 'player');

  for (const entity of playerEntities.slice(0, 5)) {
    try {
      const injuryHistory = await deps.prisma.sportsInjury.findMany({
        where: {
          playerName: { equals: entity.name, mode: 'insensitive' },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { status: true, type: true, updatedAt: true },
      });

      if (injuryHistory.length >= 3) {
        const types = injuryHistory.map((i) => i.type).filter(Boolean);
        const uniqueTypes = [...new Set(types)];
        const recurring = uniqueTypes.find(
          (t) => types.filter((x) => x === t).length >= 2
        );

        if (recurring) {
          signals.push({
            entity: entity.name,
            sport: entity.sport || 'NFL',
            signalType: 'injury_pattern',
            headline: `${entity.name} has recurring ${recurring} injury (${types.filter((x) => x === recurring).length}x in history)`,
            relevance: 0.7,
            data: {
              injuryType: recurring,
              totalInjuries: injuryHistory.length,
              history: injuryHistory.slice(0, 5),
            },
          });
        }
      }
    } catch {
    }
  }

  signals.sort((a, b) => b.relevance - a.relevance);

  return {
    signals: signals.slice(0, 10),
    enabled: true,
    fetchedAt: new Date().toISOString(),
  };
}

export interface PlayerWeight {
  name: string;
  sleeperId: string | null;
  position: string;
  team: string | null;
  dynastyValue: number;
  redraftValue: number;
  rank: number;
  positionRank: number;
  trend30Day: number;
  tier: { tier: number; label: string; description: string };
  volatility: number | null;
  age: number | null;
}

export interface PickWeight {
  year: number;
  round: number;
  dynastyValue: number;
  redraftValue: number;
  timeMultiplier: number;
  yearsOut: number;
}

export interface FantasyCalcAIContext {
  players: PlayerWeight[];
  picks: PickWeight[];
  marketMeta: {
    totalPlayers: number;
    medianValue: number;
    topPositionValues: Record<string, number>;
    trendingUp: string[];
    trendingDown: string[];
  };
  fetchedAt: string;
  settings: FantasyCalcSettings;
}

export async function fetchFantasyCalcPlayerAndPickWeights(
  deps: UpstreamDeps,
  params: {
    playerNames?: string[];
    sleeperIds?: string[];
    picks?: Array<{ year: number; round: number }>;
    settings?: Partial<FantasyCalcSettings>;
    includeTrending?: boolean;
    trendingLimit?: number;
  }
): Promise<FantasyCalcAIContext> {
  const {
    playerNames = [],
    sleeperIds = [],
    picks = [],
    settings: partialSettings,
    includeTrending = true,
    trendingLimit = 5,
  } = params;

  const {
    fetchFantasyCalcValues,
    findPlayerByName,
    findPlayerBySleeperId,
    getDetailedTier,
    getPickValue,
  } = await import('./fantasycalc');

  const fullSettings: FantasyCalcSettings = {
    isDynasty: partialSettings?.isDynasty ?? true,
    numQbs: partialSettings?.numQbs ?? 2,
    numTeams: partialSettings?.numTeams ?? 12,
    ppr: partialSettings?.ppr ?? 1,
  };

  const allPlayers = await fetchFantasyCalcValues(fullSettings);

  const playerWeights: PlayerWeight[] = [];

  for (const name of playerNames) {
    const match = findPlayerByName(allPlayers, name);
    if (match) {
      playerWeights.push(mapFcToWeight(match));
    } else {
      playerWeights.push({
        name,
        sleeperId: null,
        position: 'UNKNOWN',
        team: null,
        dynastyValue: 0,
        redraftValue: 0,
        rank: 999,
        positionRank: 999,
        trend30Day: 0,
        tier: { tier: 4, label: 'Tier 4 - Depth/Lottery', description: 'Not found in FantasyCalc' },
        volatility: null,
        age: null,
      });
    }
  }

  for (const sid of sleeperIds) {
    if (playerWeights.some((p) => p.sleeperId === sid)) continue;
    const match = findPlayerBySleeperId(allPlayers, sid);
    if (match) {
      playerWeights.push(mapFcToWeight(match));
    }
  }

  const pickWeights: PickWeight[] = [];
  const currentYear = new Date().getFullYear();

  for (const pick of picks) {
    const dynastyVal = getPickValue(pick.year, pick.round, true);
    const redraftVal = getPickValue(pick.year, pick.round, false);
    const yearsOut = Math.max(0, pick.year - currentYear);

    const TIME_MULTIPLIER: Record<number, number> = { 0: 1.0, 1: 0.92, 2: 0.85, 3: 0.8 };
    const timeMult = TIME_MULTIPLIER[yearsOut] ?? 0.75;

    pickWeights.push({
      year: pick.year,
      round: pick.round,
      dynastyValue: dynastyVal,
      redraftValue: redraftVal,
      timeMultiplier: timeMult,
      yearsOut,
    });
  }

  const values = allPlayers.map((p) => p.value).sort((a, b) => a - b);
  const medianValue = values.length > 0 ? values[Math.floor(values.length / 2)] : 0;

  const positionTopValues: Record<string, number> = {};
  const posGroups = ['QB', 'RB', 'WR', 'TE'];
  for (const pos of posGroups) {
    const topOfPos = allPlayers.find(
      (p) => p.player.position.toUpperCase() === pos
    );
    positionTopValues[pos] = topOfPos?.value || 0;
  }

  let trendingUp: string[] = [];
  let trendingDown: string[] = [];

  if (includeTrending) {
    const sorted = [...allPlayers].sort((a, b) => b.trend30Day - a.trend30Day);
    trendingUp = sorted.slice(0, trendingLimit).map((p) => `${p.player.name} (+${p.trend30Day})`);
    trendingDown = sorted
      .slice(-trendingLimit)
      .reverse()
      .map((p) => `${p.player.name} (${p.trend30Day})`);
  }

  return {
    players: playerWeights,
    picks: pickWeights,
    marketMeta: {
      totalPlayers: allPlayers.length,
      medianValue,
      topPositionValues: positionTopValues,
      trendingUp,
      trendingDown,
    },
    fetchedAt: new Date().toISOString(),
    settings: fullSettings,
  };

  function mapFcToWeight(fc: FantasyCalcPlayer): PlayerWeight {
    return {
      name: fc.player.name,
      sleeperId: fc.player.sleeperId || null,
      position: fc.player.position,
      team: fc.player.maybeTeam,
      dynastyValue: fc.value,
      redraftValue: fc.redraftValue,
      rank: fc.overallRank,
      positionRank: fc.positionRank,
      trend30Day: fc.trend30Day,
      tier: getDetailedTier(fc.value, fc.overallRank, fc.player.position),
      volatility: fc.maybeMovingStandardDeviationPerc ?? null,
      age: fc.player.maybeAge,
    };
  }
}

export function formatNewsForAIPrompt(result: NewsContextResult): string {
  if (result.items.length === 0) return '';

  const lines: string[] = [
    `## NEWS & INJURY CONTEXT (${result.items.length} items, sources: ${result.sources.join(', ')})`,
  ];

  const directItems = result.items.filter((i) => i.relevance === 'direct');
  const teamItems = result.items.filter((i) => i.relevance === 'team');
  const otherItems = result.items.filter(
    (i) => i.relevance !== 'direct' && i.relevance !== 'team'
  );

  if (directItems.length > 0) {
    lines.push('\n### Directly Relevant:');
    for (const item of directItems) {
      const tag = item.isInjury ? '[INJURY]' : '[NEWS]';
      lines.push(`- ${tag} ${item.title} (${item.source}, ${item.publishedAt})`);
    }
  }

  if (teamItems.length > 0) {
    lines.push('\n### Team Context:');
    for (const item of teamItems.slice(0, 8)) {
      const tag = item.isInjury ? '[INJURY]' : '[NEWS]';
      lines.push(`- ${tag} ${item.title} (${item.source})`);
    }
  }

  if (otherItems.length > 0 && directItems.length + teamItems.length < 5) {
    lines.push('\n### League-Wide:');
    for (const item of otherItems.slice(0, 5)) {
      lines.push(`- ${item.title} (${item.source})`);
    }
  }

  return lines.join('\n');
}

export function formatRollingInsightsForAIPrompt(result: RollingInsightsResult): string {
  if (result.players.length === 0 && result.teams.length === 0) return '';

  const lines: string[] = [
    `## PLAYER PROFILES & STATS (source: Rolling Insights, ${result.source})`,
  ];

  for (const p of result.players) {
    const fpgStr = p.fantasyPointsPerGame != null ? `${p.fantasyPointsPerGame.toFixed(1)} FPPG` : 'N/A FPPG';
    const gpStr = p.gamesPlayed != null ? `${p.gamesPlayed} GP` : '';
    lines.push(
      `- ${p.name} | ${p.position || '?'} | ${p.team || '?'} | ${fpgStr}${gpStr ? `, ${gpStr}` : ''} | Status: ${p.status || 'Active'}`
    );

    if (p.seasonStats) {
      const stats = p.seasonStats as any;
      const statParts: string[] = [];
      if (stats.passing_yards) statParts.push(`${stats.passing_yards} pass yds, ${stats.passing_touchdowns || 0} TD, ${stats.interceptions || 0} INT`);
      if (stats.rushing_yards) statParts.push(`${stats.rushing_yards} rush yds, ${stats.rushing_touchdowns || 0} rush TD`);
      if (stats.receiving_yards) statParts.push(`${stats.receiving_yards} rec yds, ${stats.receiving_touchdowns || 0} rec TD, ${stats.receptions || 0} rec`);
      if (statParts.length > 0) {
        lines.push(`  Stats: ${statParts.join(' | ')}`);
      }
    }
  }

  if (result.teams.length > 0) {
    lines.push('\nTeams:');
    for (const t of result.teams) {
      lines.push(`- ${t.name} (${t.abbrev}) — ${t.playerCount} rostered players`);
    }
  }

  return lines.join('\n');
}

export function formatFantasyCalcForAIPrompt(ctx: FantasyCalcAIContext): string {
  if (ctx.players.length === 0 && ctx.picks.length === 0) return '';

  const lines: string[] = [
    `## MARKET VALUES (FantasyCalc, ${ctx.settings.isDynasty ? 'Dynasty' : 'Redraft'}, ${ctx.settings.numQbs}QB, ${ctx.settings.numTeams}-team, ${ctx.settings.ppr} PPR)`,
  ];

  if (ctx.players.length > 0) {
    lines.push('\nPlayers:');
    for (const p of ctx.players) {
      const trendStr = p.trend30Day > 0 ? `+${p.trend30Day}` : `${p.trend30Day}`;
      const ageStr = p.age ? `, Age ${p.age}` : '';
      const volStr = p.volatility != null ? `, Vol ${(p.volatility * 100).toFixed(1)}%` : '';
      lines.push(
        `- ${p.name}: Dynasty ${p.dynastyValue} / Redraft ${p.redraftValue} | ${p.tier.label} | #${p.rank} overall (#${p.positionRank} ${p.position})${ageStr} | 30d: ${trendStr}${volStr}`
      );
    }
  }

  if (ctx.picks.length > 0) {
    lines.push('\nPicks:');
    for (const pk of ctx.picks) {
      lines.push(
        `- ${pk.year} Rd${pk.round}: Dynasty ${pk.dynastyValue} / Redraft ${pk.redraftValue} (${pk.yearsOut}yr out, ×${pk.timeMultiplier.toFixed(2)})`
      );
    }
  }

  if (ctx.marketMeta.trendingUp.length > 0) {
    lines.push(`\nTrending Up: ${ctx.marketMeta.trendingUp.join(', ')}`);
  }
  if (ctx.marketMeta.trendingDown.length > 0) {
    lines.push(`Trending Down: ${ctx.marketMeta.trendingDown.join(', ')}`);
  }

  lines.push(
    `\nMarket: ${ctx.marketMeta.totalPlayers} players, median value ${ctx.marketMeta.medianValue} | Top QB: ${ctx.marketMeta.topPositionValues['QB'] || 0}, RB: ${ctx.marketMeta.topPositionValues['RB'] || 0}, WR: ${ctx.marketMeta.topPositionValues['WR'] || 0}, TE: ${ctx.marketMeta.topPositionValues['TE'] || 0}`
  );

  return lines.join('\n');
}
