import type { PrismaClient } from '@prisma/client';
import {
  fetchNewsContext,
  fetchRollingInsights,
  fetchCrossSportSignals,
  fetchFantasyCalcPlayerAndPickWeights,
  formatNewsForAIPrompt,
  formatRollingInsightsForAIPrompt,
  formatFantasyCalcForAIPrompt,
  type NewsContextResult,
  type RollingInsightsResult,
  type CrossSportResult,
  type FantasyCalcAIContext,
  type UpstreamDeps,
} from './upstream-apis';
import { readCache, writeCache } from './enrichment-cache';
import { getAllPlayers, getPlayerName, type SleeperPlayer } from './sleeper-client';

export interface LeagueSnapshot {
  username: string;
  total_seasons: number;
  total_standard_leagues: number;
  total_leagues_including_specialty: number;
  total_wins: number;
  total_losses: number;
  win_percentage: number;
  championships: number;
  playoff_appearances: number;
  playoff_rate: number;
  total_points: number;
  consistency_variance: number;
  best_season: string | null;
  worst_season: string | null;
  season_breakdown: Record<string, unknown>;
  league_types: (string | null)[];
  league_history: Array<Record<string, unknown>>;
  specialty_leagues_excluded: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface RosterSnapshot {
  leagueName: string;
  leagueType: string | null;
  season: number;
  teamCount: number | null;
  isSF: boolean;
  isTEP: boolean;
  starters: PlayerRef[];
  bench: PlayerRef[];
  ir: PlayerRef[];
  taxi: PlayerRef[];
  draftPicks: DraftPickRef[];
}

interface PlayerRef {
  sleeperId: string;
  name: string;
  position: string | null;
  team: string | null;
  age: number | null;
}

interface DraftPickRef {
  season: string;
  round: number;
  originalOwner: number;
}

export interface DataFreshness {
  newsAge: string;
  rollingInsightsSource: string;
  fantasyCalcFetchedAt: string;
  crossSportEnabled: boolean;
  assembledAt: string;
}

export interface SourceAudit {
  newsSourceCount: number;
  newsSources: string[];
  newsItemCount: number;
  playerHits: number;
  teamHits: number;
  rollingInsightsPlayerCount: number;
  fantasyCalcPlayerCount: number;
  fantasyCalcPickCount: number;
  crossSportSignalCount: number;
  errors: string[];
  partialData: boolean;
  missingSources: string[];
}

export interface EnrichedLegacyContext {
  leagueSnapshot: LeagueSnapshot;
  currentRosters: RosterSnapshot[];
  playerValueSignals: FantasyCalcAIContext | null;
  recentNews: NewsContextResult | null;
  rollingInsights: RollingInsightsResult | null;
  crossSportContext: CrossSportResult | null;
  dataFreshness: DataFreshness;
  sourceAudit: SourceAudit;
}

interface LegacyUserPayload {
  displayName: string | null;
  sleeperUsername: string;
  leagues: Array<{
    id: string;
    name: string;
    season: number;
    leagueType: string | null;
    specialtyFormat?: string | null;
    teamCount?: number | null;
    isSF?: boolean;
    isTEP?: boolean;
    rosters: Array<{
      isOwner: boolean;
      wins: number;
      losses: number;
      pointsFor: number;
      isChampion: boolean;
      playoffSeed: number | null;
      finalStanding: number | null;
      players: unknown;
    }>;
  }>;
}

interface AssembleOptions {
  enableCrossSport?: boolean;
  hoursBackNews?: number;
  maxPlayers?: number;
  skipCache?: boolean;
}

export async function assembleLegacyAIContext(
  prisma: PrismaClient,
  user: LegacyUserPayload,
  leagueSnapshot: LeagueSnapshot,
  options: AssembleOptions = {}
): Promise<EnrichedLegacyContext> {
  const {
    enableCrossSport = false,
    hoursBackNews = 72,
    maxPlayers = 40,
    skipCache = false,
  } = options;

  if (!skipCache) {
    const aggCacheKey = {
      username: user.sleeperUsername,
      leagueCount: user.leagues.length,
      latestSeason: Math.max(...user.leagues.map(l => l.season), 0),
      enableCrossSport,
    };
    const cached = await readCache<EnrichedLegacyContext>(prisma, 'enrichment_aggregate', aggCacheKey);
    if (cached) {
      return { ...cached.data, dataFreshness: { ...cached.data.dataFreshness, assembledAt: cached.fetchedAt } };
    }
  }

  const errors: string[] = [];
  const deps: UpstreamDeps = {
    prisma,
    newsApiKey: process.env.NEWSAPI_KEY,
  };

  let sleeperPlayers: Record<string, SleeperPlayer> = {};
  try {
    sleeperPlayers = await getAllPlayers();
  } catch (err) {
    errors.push(`Sleeper player map failed: ${String(err)}`);
  }

  const { playerRefs, teamAbbrevs, currentRosters, draftPicks } = extractRosterData(
    user,
    sleeperPlayers,
    maxPlayers
  );

  const playerNames = playerRefs.map((p) => p.name);
  const uniqueTeams = [...new Set(teamAbbrevs)];

  const [newsResult, insightsResult, calcResult, crossSportResult] = await Promise.allSettled([
    fetchNewsContext(deps, {
      playerNames: playerNames.slice(0, 15),
      teamAbbrevs: uniqueTeams,
      hoursBack: hoursBackNews,
      limit: 20,
    }),
    fetchRollingInsights(deps, {
      playerNames: playerNames.slice(0, 20),
      teamAbbrevs: uniqueTeams,
    }),
    fetchFantasyCalcPlayerAndPickWeights(deps, {
      playerNames: playerNames.slice(0, maxPlayers),
      picks: draftPicks.map((p) => ({ year: parseInt(p.season) || new Date().getFullYear(), round: p.round })),
      settings: inferCalcSettings(user),
      includeTrending: true,
      trendingLimit: 5,
    }),
    fetchCrossSportSignals(deps, {
      entities: [
        ...playerNames.slice(0, 10).map((n) => ({ name: n, type: 'player' as const })),
        ...uniqueTeams.map((t) => ({ name: t, type: 'team' as const })),
      ],
      enabled: enableCrossSport,
    }),
  ]);

  const missingSources: string[] = [];

  const news = newsResult.status === 'fulfilled' ? newsResult.value : null;
  if (newsResult.status === 'rejected') {
    errors.push(`News: ${String(newsResult.reason)}`);
    missingSources.push('news');
  }

  const insights = insightsResult.status === 'fulfilled' ? insightsResult.value : null;
  if (insightsResult.status === 'rejected') {
    errors.push(`RollingInsights: ${String(insightsResult.reason)}`);
    missingSources.push('rolling_insights');
  }

  const calc = calcResult.status === 'fulfilled' ? calcResult.value : null;
  if (calcResult.status === 'rejected') {
    errors.push(`FantasyCalc: ${String(calcResult.reason)}`);
    missingSources.push('fantasycalc');
  }

  const crossSport = crossSportResult.status === 'fulfilled' ? crossSportResult.value : null;
  if (crossSportResult.status === 'rejected') {
    errors.push(`CrossSport: ${String(crossSportResult.reason)}`);
    missingSources.push('cross_sport');
  }

  const now = new Date().toISOString();

  const dataFreshness: DataFreshness = {
    newsAge: news?.fetchedAt || 'unavailable',
    rollingInsightsSource: insights?.source || 'unavailable',
    fantasyCalcFetchedAt: calc?.fetchedAt || 'unavailable',
    crossSportEnabled: enableCrossSport,
    assembledAt: now,
  };

  const sourceAudit: SourceAudit = {
    newsSourceCount: news?.sources.length || 0,
    newsSources: news?.sources || [],
    newsItemCount: news?.items.length || 0,
    playerHits: news?.playerHits || 0,
    teamHits: news?.teamHits || 0,
    rollingInsightsPlayerCount: insights?.players.length || 0,
    fantasyCalcPlayerCount: calc?.players.length || 0,
    fantasyCalcPickCount: calc?.picks.length || 0,
    crossSportSignalCount: crossSport?.signals.length || 0,
    errors,
    partialData: missingSources.length > 0,
    missingSources,
  };

  const enrichedContext: EnrichedLegacyContext = {
    leagueSnapshot,
    currentRosters,
    playerValueSignals: calc,
    recentNews: news,
    rollingInsights: insights,
    crossSportContext: crossSport,
    dataFreshness,
    sourceAudit,
  };

  if (!skipCache && !sourceAudit.partialData) {
    const aggCacheKey = {
      username: user.sleeperUsername,
      leagueCount: user.leagues.length,
      latestSeason: Math.max(...user.leagues.map(l => l.season), 0),
      enableCrossSport,
    };
    writeCache(prisma, 'enrichment_aggregate', aggCacheKey, enrichedContext, 'enrichment').catch(() => {});
  }

  return enrichedContext;
}

function extractRosterData(
  user: LegacyUserPayload,
  sleeperPlayers: Record<string, SleeperPlayer>,
  maxPlayers: number
): {
  playerRefs: PlayerRef[];
  teamAbbrevs: string[];
  currentRosters: RosterSnapshot[];
  draftPicks: DraftPickRef[];
} {
  const playerRefs: PlayerRef[] = [];
  const teamAbbrevs: string[] = [];
  const currentRosters: RosterSnapshot[] = [];
  const draftPicks: DraftPickRef[] = [];
  const seenPlayerIds = new Set<string>();

  const sortedLeagues = [...user.leagues].sort((a, b) => b.season - a.season);

  const latestSeason = sortedLeagues[0]?.season;
  const currentLeagues = sortedLeagues.filter((l) => l.season === latestSeason);

  for (const league of currentLeagues) {
    const ownerRoster = league.rosters.find((r) => r.isOwner);
    if (!ownerRoster?.players) continue;

    const playersData = ownerRoster.players as Record<string, unknown>;
    const rosterSnap: RosterSnapshot = {
      leagueName: league.name,
      leagueType: league.leagueType,
      season: league.season,
      teamCount: league.teamCount ?? null,
      isSF: league.isSF ?? false,
      isTEP: league.isTEP ?? false,
      starters: [],
      bench: [],
      ir: [],
      taxi: [],
      draftPicks: [],
    };

    const slotMap: Record<string, keyof Pick<RosterSnapshot, 'starters' | 'bench' | 'ir' | 'taxi'>> = {
      starters: 'starters',
      bench: 'bench',
      ir: 'ir',
      taxi: 'taxi',
    };

    for (const [slot, key] of Object.entries(slotMap)) {
      const ids = playersData[slot];
      if (!Array.isArray(ids)) continue;

      for (const id of ids) {
        if (typeof id !== 'string') continue;
        const ref = resolvePlayer(id, sleeperPlayers);
        rosterSnap[key].push(ref);

        if (!seenPlayerIds.has(id) && playerRefs.length < maxPlayers) {
          seenPlayerIds.add(id);
          playerRefs.push(ref);
          if (ref.team) teamAbbrevs.push(ref.team);
        }
      }
    }

    const picks = playersData['draftPicks'];
    if (Array.isArray(picks)) {
      for (const pick of picks) {
        if (pick && typeof pick === 'object') {
          const p = pick as Record<string, unknown>;
          const pickRef: DraftPickRef = {
            season: String(p.season || new Date().getFullYear()),
            round: typeof p.round === 'number' ? p.round : 1,
            originalOwner: typeof p.original_owner_id === 'number' ? p.original_owner_id : 0,
          };
          rosterSnap.draftPicks.push(pickRef);
          draftPicks.push(pickRef);
        }
      }
    }

    currentRosters.push(rosterSnap);
  }

  return { playerRefs, teamAbbrevs, currentRosters, draftPicks };
}

function resolvePlayer(
  sleeperId: string,
  sleeperPlayers: Record<string, SleeperPlayer>
): PlayerRef {
  const p = sleeperPlayers[sleeperId];
  if (!p) {
    return { sleeperId, name: sleeperId, position: null, team: null, age: null };
  }
  return {
    sleeperId,
    name: p.full_name || `${p.first_name} ${p.last_name}`,
    position: p.position || null,
    team: p.team || null,
    age: p.age ?? null,
  };
}

function inferCalcSettings(user: LegacyUserPayload): Partial<import('./fantasycalc').FantasyCalcSettings> {
  const currentLeagues = user.leagues.filter(
    (l) => l.season === Math.max(...user.leagues.map((ll) => ll.season))
  );

  const hasDynasty = currentLeagues.some(
    (l) => l.leagueType?.toLowerCase().includes('dynasty') || l.leagueType?.toLowerCase().includes('keeper')
  );
  const hasSF = currentLeagues.some((l) => l.isSF);

  const teamCounts = currentLeagues.map((l) => l.teamCount).filter((t): t is number => t != null);
  const avgTeams = teamCounts.length > 0
    ? Math.round(teamCounts.reduce((a, b) => a + b, 0) / teamCounts.length)
    : 12;

  return {
    isDynasty: hasDynasty,
    numQbs: (hasSF ? 2 : 1) as 1 | 2,
    numTeams: avgTeams,
    ppr: 1,
  };
}

export function formatEnrichedContextForPrompt(ctx: EnrichedLegacyContext): string {
  const sections: string[] = [];

  if (ctx.currentRosters.length > 0) {
    sections.push('## CURRENT ROSTERS');
    for (const roster of ctx.currentRosters) {
      sections.push(`\n### ${roster.leagueName} (${roster.season}, ${roster.leagueType || 'unknown'}, ${roster.teamCount || '?'}-team${roster.isSF ? ', SF' : ''}${roster.isTEP ? ', TEP' : ''})`);

      if (roster.starters.length > 0) {
        sections.push('**Starters:**');
        sections.push(roster.starters.map((p) => `- ${p.name} (${p.position || '?'}, ${p.team || '?'}${p.age ? `, age ${p.age}` : ''})`).join('\n'));
      }
      if (roster.bench.length > 0) {
        sections.push(`**Bench (${roster.bench.length}):**`);
        sections.push(roster.bench.map((p) => `- ${p.name} (${p.position || '?'}, ${p.team || '?'}${p.age ? `, age ${p.age}` : ''})`).join('\n'));
      }
      if (roster.taxi.length > 0) {
        sections.push(`**Taxi (${roster.taxi.length}):**`);
        sections.push(roster.taxi.map((p) => `- ${p.name} (${p.position || '?'}${p.age ? `, age ${p.age}` : ''})`).join('\n'));
      }
      if (roster.ir.length > 0) {
        sections.push(`**IR (${roster.ir.length}):**`);
        sections.push(roster.ir.map((p) => `- ${p.name} (${p.position || '?'})`).join('\n'));
      }
      if (roster.draftPicks.length > 0) {
        sections.push(`**Draft Picks (${roster.draftPicks.length}):**`);
        const pickSummary = roster.draftPicks
          .map((p) => `${p.season} Rd${p.round}`)
          .join(', ');
        sections.push(pickSummary);
      }
    }
  }

  if (ctx.playerValueSignals) {
    sections.push(formatFantasyCalcForAIPrompt(ctx.playerValueSignals));
  }

  if (ctx.recentNews) {
    const newsPrompt = formatNewsForAIPrompt(ctx.recentNews);
    if (newsPrompt) sections.push(newsPrompt);
  }

  if (ctx.rollingInsights) {
    const insightsPrompt = formatRollingInsightsForAIPrompt(ctx.rollingInsights);
    if (insightsPrompt) sections.push(insightsPrompt);
  }

  if (ctx.crossSportContext?.enabled && ctx.crossSportContext.signals.length > 0) {
    sections.push('## CROSS-SPORT SIGNALS');
    for (const sig of ctx.crossSportContext.signals) {
      sections.push(`- [${sig.signalType}] ${sig.headline} (relevance: ${sig.relevance})`);
    }
  }

  sections.push(`\n## DATA FRESHNESS\n- News: ${ctx.dataFreshness.newsAge}\n- Player Stats: ${ctx.dataFreshness.rollingInsightsSource}\n- Valuations: ${ctx.dataFreshness.fantasyCalcFetchedAt}\n- Assembled: ${ctx.dataFreshness.assembledAt}`);

  if (ctx.sourceAudit.errors.length > 0) {
    sections.push(`\n## DATA GAPS\n${ctx.sourceAudit.errors.map((e) => `- ${e}`).join('\n')}`);
  }

  return sections.join('\n\n');
}
