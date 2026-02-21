import { prisma } from './prisma';
import {
  fetchNFLRoster,
  fetchNFLTeams,
  fetchNFLSchedule,
  searchNFLPlayer,
  getCurrentNFLSeason,
  fetchNFLDepthCharts,
  fetchNFLTeamsFull,
  type RIPlayer,
  type RITeam,
  type RIScheduleGame,
} from './rolling-insights';
import {
  fetchAPISportsTeams,
  fetchAPISportsPlayerBySearch,
  fetchAPISportsGames,
  fetchAPISportsStandings,
  fetchAPISportsPlayerStatistics,
  getCurrentNFLSeasonForAPISports,
  teamNameToAbbrev as apiSportsTeamToAbbrev,
  type APISportsTeam,
  type APISportsPlayer,
  type APISportsGame,
  type APISportsStanding,
} from './api-sports';
import { normalizeTeamAbbrev } from './team-abbrev';

export type Sport = 'NFL' | 'NBA' | 'MLB';
export type DataType = 'teams' | 'players' | 'games' | 'stats' | 'standings' | 'schedule' | 'depth_charts' | 'team_stats';

interface SportsDataRequest {
  sport: Sport;
  dataType: DataType;
  identifier?: string;
  dateRange?: { start?: Date; end?: Date };
  season?: string;
  forceRefresh?: boolean;
}

interface SportsDataResponse {
  data: unknown;
  source: string;
  cached: boolean;
  fetchedAt: Date;
}

const API_PRIORITY: Record<Sport, string[]> = {
  NFL: ['rolling_insights', 'api_sports', 'thesportsdb', 'espn'],
  NBA: ['thesportsdb', 'espn'],
  MLB: ['thesportsdb', 'espn'],
};

const FRESHNESS_RULES: Record<DataType, number> = {
  teams: 7 * 24 * 60 * 60 * 1000,
  players: 24 * 60 * 60 * 1000,
  games: 60 * 1000,
  stats: 6 * 60 * 60 * 1000,
  standings: 6 * 60 * 60 * 1000,
  schedule: 12 * 60 * 60 * 1000,
  depth_charts: 12 * 60 * 60 * 1000,
  team_stats: 24 * 60 * 60 * 1000,
};

const THESPORTSDB_LEAGUE_IDS: Record<string, string> = {
  NFL: '4391',
  NBA: '4387',
  MLB: '4424',
};

const ESPN_PATHS: Record<string, string> = {
  NFL: 'football/nfl',
  NBA: 'basketball/nba',
  MLB: 'baseball/mlb',
};

interface NormalizedTeam {
  id: string;
  name: string;
  shortName: string;
  mascot?: string;
  city?: string;
  logo?: string | null;
  source: string;
}

interface NormalizedPlayer {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  teamId: string | null;
  number: number | null;
  height: string | null;
  weight: number | null;
  college: string | null;
  dob: string | null;
  status: string | null;
  img: string | null;
  fantasyPoints: number | null;
  seasonStats: unknown[];
  source: string;
}

interface NormalizedGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string | null;
  status: string | null;
  season: string | null;
  venue: string | null;
  source: string;
}

async function fetchFromRollingInsights(
  dataType: DataType,
  identifier?: string,
  season?: string,
): Promise<unknown | null> {
  const clientId = process.env.ROLLING_INSIGHTS_CLIENT_ID;
  const clientSecret = process.env.ROLLING_INSIGHTS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const currentSeason = season || getCurrentNFLSeason();

    switch (dataType) {
      case 'teams': {
        const teams = await fetchNFLTeams();
        return teams.map((t: RITeam): NormalizedTeam => ({
          id: t.id,
          name: t.team,
          shortName: t.abbrv,
          mascot: t.mascot,
          city: t.team.replace(` ${t.mascot}`, ''),
          logo: t.img,
          source: 'rolling_insights',
        }));
      }
      case 'players': {
        if (!identifier) return null;
        const players = await searchNFLPlayer(identifier);
        return players.map((p: RIPlayer): NormalizedPlayer => ({
          id: p.id,
          name: p.player,
          position: p.position,
          team: normalizeTeamAbbrev(p.team?.abbrv) || null,
          teamId: p.team?.id || null,
          number: p.number,
          height: p.height,
          weight: p.weight,
          college: p.college,
          dob: p.dob,
          status: p.status,
          img: p.img,
          fantasyPoints: p.regularSeason?.find(s => s.period === currentSeason)?.DK_fantasy_points || null,
          seasonStats: p.regularSeason || [],
          source: 'rolling_insights',
        }));
      }
      case 'stats': {
        if (!identifier) return null;
        const players = await searchNFLPlayer(identifier);
        if (!players.length) return null;
        return players.map((p: RIPlayer) => ({
          id: p.id,
          name: p.player,
          position: p.position,
          team: p.team?.abbrv || null,
          regularSeason: p.regularSeason || [],
          postSeason: p.postSeason || [],
          source: 'rolling_insights',
        }));
      }
      case 'games':
      case 'schedule': {
        const games = await fetchNFLSchedule({ season: currentSeason });
        return games.map((g: RIScheduleGame): NormalizedGame => ({
          id: g.gameId,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          date: g.date,
          status: g.status,
          season: g.season,
          venue: g.venue?.arena || null,
          source: 'rolling_insights',
        }));
      }
      case 'standings':
        return null;
      case 'depth_charts': {
        const charts = await fetchNFLDepthCharts({
          season: currentSeason,
          teamName: identifier,
        });
        return charts.map(c => ({
          team: c.abbrv,
          teamName: c.team,
          positions: c.positions,
          source: 'rolling_insights',
        }));
      }
      case 'team_stats': {
        const teams = await fetchNFLTeamsFull({
          season: currentSeason,
          teamName: identifier,
        });
        return teams.map(t => ({
          team: t.abbrv,
          teamName: t.team,
          record: t.record,
          regularSeason: t.regularSeason,
          postSeason: t.postSeason,
          injuries: t.injuries,
          bye: t.bye,
          conference: t.conf,
          dome: t.dome,
          source: 'rolling_insights',
        }));
      }
      default:
        return null;
    }
  } catch (error) {
    console.error('[SportsRouter] Rolling Insights fetch failed:', error);
    return null;
  }
}

async function fetchFromAPISports(
  dataType: DataType,
  identifier?: string,
  season?: string,
): Promise<unknown | null> {
  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) return null;

  try {
    const currentSeason = season || getCurrentNFLSeasonForAPISports();

    switch (dataType) {
      case 'teams': {
        const teams = await fetchAPISportsTeams();
        return teams.map((t: APISportsTeam): NormalizedTeam => ({
          id: String(t.id),
          name: t.name,
          shortName: apiSportsTeamToAbbrev(t.name) || t.name,
          city: t.city || undefined,
          logo: t.logo,
          source: 'api_sports',
        }));
      }
      case 'players': {
        if (!identifier) return null;
        const players = await fetchAPISportsPlayerBySearch(identifier, currentSeason);
        return players.map((p: APISportsPlayer): NormalizedPlayer => ({
          id: String(p.id),
          name: p.name,
          position: p.position || p.group || null,
          team: p.team ? apiSportsTeamToAbbrev(p.team.name) : null,
          teamId: p.team ? String(p.team.id) : null,
          number: p.number,
          height: p.height,
          weight: p.weight ? parseInt(p.weight) || null : null,
          college: p.college,
          dob: null,
          status: null,
          img: p.image,
          fantasyPoints: null,
          seasonStats: [],
          source: 'api_sports',
        }));
      }
      case 'games':
      case 'schedule': {
        const games = await fetchAPISportsGames(currentSeason);
        return games.map((g: APISportsGame): NormalizedGame => ({
          id: String(g.game.id),
          homeTeam: apiSportsTeamToAbbrev(g.teams.home.name) || g.teams.home.name,
          awayTeam: apiSportsTeamToAbbrev(g.teams.away.name) || g.teams.away.name,
          date: g.game.date.date,
          status: g.game.status.long,
          season: g.league.season,
          venue: g.game.venue?.name || null,
          source: 'api_sports',
        }));
      }
      case 'stats': {
        if (!identifier) return null;
        const players = await fetchAPISportsPlayerBySearch(identifier, currentSeason);
        if (!players.length) return null;
        const playerWithStats = [];
        for (const p of players.slice(0, 3)) {
          try {
            const stats = await fetchAPISportsPlayerStatistics(String(p.id), currentSeason);
            playerWithStats.push({
              id: String(p.id),
              name: p.name,
              position: p.position || p.group || null,
              team: p.team ? apiSportsTeamToAbbrev(p.team.name) : null,
              statistics: stats,
              source: 'api_sports',
            });
          } catch {
            playerWithStats.push({
              id: String(p.id),
              name: p.name,
              position: p.position || p.group || null,
              team: p.team ? apiSportsTeamToAbbrev(p.team.name) : null,
              statistics: [],
              source: 'api_sports',
            });
          }
        }
        return playerWithStats;
      }
      case 'standings': {
        const standings = await fetchAPISportsStandings(currentSeason);
        return standings.map((s: APISportsStanding) => ({
          team: apiSportsTeamToAbbrev(s.team.name),
          teamName: s.team.name,
          logo: s.team.logo,
          position: s.position,
          won: s.won,
          lost: s.lost,
          tied: s.tied,
          pointsFor: s.points.for,
          pointsAgainst: s.points.against,
          conference: s.group?.conference || null,
          division: s.group?.name || null,
          source: 'api_sports',
        }));
      }
      default:
        return null;
    }
  } catch (error) {
    console.error('[SportsRouter] API-Sports fetch failed:', error);
    return null;
  }
}

async function fetchFromTheSportsDB(sport: Sport, dataType: DataType, identifier?: string): Promise<unknown | null> {
  const apiKey = process.env.THESPORTSDB_API_KEY || '3';
  const leagueId = THESPORTSDB_LEAGUE_IDS[sport];
  if (!leagueId) return null;

  let url = '';

  switch (dataType) {
    case 'teams':
      url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/lookup_all_teams.php?id=${leagueId}`;
      break;
    case 'players':
      if (identifier) {
        url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchplayers.php?t=${encodeURIComponent(identifier)}`;
      } else {
        return null;
      }
      break;
    case 'games':
    case 'schedule':
      url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsnextleague.php?id=${leagueId}`;
      break;
    case 'standings':
      url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/lookuptable.php?l=${leagueId}`;
      break;
    default:
      return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchFromESPN(sport: Sport, dataType: DataType): Promise<unknown | null> {
  const path = ESPN_PATHS[sport];
  if (!path) return null;

  let url = '';

  switch (dataType) {
    case 'teams':
      url = `https://site.api.espn.com/apis/site/v2/sports/${path}/teams`;
      break;
    case 'games':
    case 'schedule':
      url = `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`;
      break;
    case 'standings':
      url = `https://site.api.espn.com/apis/site/v2/sports/${path}/standings`;
      break;
    default:
      return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeTheSportsDBData(data: unknown, dataType: DataType): unknown {
  if (!data) return null;
  const d = data as Record<string, unknown>;
  if (dataType === 'teams' && d.teams) return d.teams;
  if (dataType === 'games' && d.events) return d.events;
  if (dataType === 'standings' && d.table) return d.table;
  if (dataType === 'players' && d.player) return d.player;
  if (dataType === 'schedule' && d.events) return d.events;
  return data;
}

function normalizeESPNData(data: unknown, dataType: DataType): unknown {
  if (!data) return null;
  const d = data as Record<string, unknown>;
  if (dataType === 'teams' && d.sports) {
    const sports = d.sports as Array<{ leagues?: Array<{ teams?: unknown[] }> }>;
    return sports[0]?.leagues?.[0]?.teams || [];
  }
  if ((dataType === 'games' || dataType === 'schedule') && d.events) return d.events;
  if (dataType === 'standings' && d.children) return d.children;
  return data;
}

async function fetchFromSource(
  source: string,
  sport: Sport,
  dataType: DataType,
  identifier?: string,
  season?: string,
): Promise<unknown | null> {
  switch (source) {
    case 'rolling_insights':
      if (sport !== 'NFL') return null;
      return fetchFromRollingInsights(dataType, identifier, season);
    case 'api_sports':
      if (sport !== 'NFL') return null;
      return fetchFromAPISports(dataType, identifier, season);
    case 'thesportsdb': {
      const raw = await fetchFromTheSportsDB(sport, dataType, identifier);
      return normalizeTheSportsDBData(raw, dataType);
    }
    case 'espn': {
      const raw = await fetchFromESPN(sport, dataType);
      return normalizeESPNData(raw, dataType);
    }
    default:
      return null;
  }
}

async function tryNFLFromDb(dataType: DataType, identifier?: string): Promise<SportsDataResponse | null> {
  try {
    if (dataType === 'teams') {
      const teams = await getNFLTeamsFromDb();
      if (teams.length > 0) {
        return { data: teams, source: 'rolling_insights_db', cached: true, fetchedAt: new Date() };
      }
    }

    if ((dataType === 'players' || dataType === 'stats') && identifier) {
      const player = await getNFLPlayerFromDb(identifier);
      if (player) {
        if (dataType === 'stats') {
          return {
            data: [{ id: player.id, name: player.name, position: player.position, team: player.team, regularSeason: player.seasonStats, postSeason: [], source: 'rolling_insights_db' }],
            source: 'rolling_insights_db',
            cached: true,
            fetchedAt: new Date(),
          };
        }
        return { data: [player], source: 'rolling_insights_db', cached: true, fetchedAt: new Date() };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function getSportsData(request: SportsDataRequest): Promise<SportsDataResponse> {
  const { sport, dataType, identifier, season, forceRefresh } = request;
  const cacheKey = identifier || 'all';

  const key = `${sport}:${dataType}:${cacheKey}`;

  if (!forceRefresh) {
    const cached = await (prisma.sportsDataCache as any).findUnique({
      where: { key },
    });

    if (cached && cached.expiresAt > new Date()) {
      return {
        data: cached.data,
        source: 'cache',
        cached: true,
        fetchedAt: cached.createdAt,
      };
    }

    if (cached) {
      refreshInBackground(sport, dataType, identifier, season);
      return {
        data: cached.data,
        source: 'cache',
        cached: true,
        fetchedAt: cached.createdAt,
      };
    }
  }

  if (sport === 'NFL' && !forceRefresh) {
    const dbResult = await tryNFLFromDb(dataType, identifier);
    if (dbResult) return dbResult;
  }

  const sources = API_PRIORITY[sport];
  let fetchedData: unknown = null;
  let usedSource = '';

  for (const source of sources) {
    const data = await fetchFromSource(source, sport, dataType, identifier, season);
    if (data) {
      fetchedData = data;
      usedSource = source;
      break;
    }
  }

  if (!fetchedData) {
    throw new Error(`Failed to fetch ${dataType} for ${sport} from any source`);
  }

  const freshnessMs = FRESHNESS_RULES[dataType];
  const expiresAt = new Date(Date.now() + freshnessMs);

  await (prisma.sportsDataCache as any).upsert({
    where: { key },
    update: {
      data: fetchedData as object,
      expiresAt,
    },
    create: {
      key,
      data: fetchedData as object,
      expiresAt,
    },
  });

  return {
    data: fetchedData,
    source: usedSource,
    cached: false,
    fetchedAt: new Date(),
  };
}

async function refreshInBackground(sport: Sport, dataType: DataType, identifier?: string, season?: string) {
  const cacheKey = identifier || 'all';
  const key = `${sport}:${dataType}:${cacheKey}`;
  const sources = API_PRIORITY[sport];

  for (const source of sources) {
    const data = await fetchFromSource(source, sport, dataType, identifier, season);
    if (data) {
      const freshnessMs = FRESHNESS_RULES[dataType];
      const expiresAt = new Date(Date.now() + freshnessMs);

      await (prisma.sportsDataCache as any).upsert({
        where: { key },
        update: {
          data: data as object,
          expiresAt,
        },
        create: {
          key,
          data: data as object,
          expiresAt,
        },
      });
      break;
    }
  }
}

export async function getTeams(sport: Sport) {
  return getSportsData({ sport, dataType: 'teams' });
}

export async function getGames(sport: Sport, options?: { season?: string }) {
  return getSportsData({ sport, dataType: 'games', season: options?.season });
}

export async function getStandings(sport: Sport) {
  return getSportsData({ sport, dataType: 'standings' });
}

export async function getPlayer(sport: Sport, searchTerm: string) {
  return getSportsData({ sport, dataType: 'players', identifier: searchTerm });
}

export async function getPlayerStats(sport: Sport, searchTerm: string) {
  return getSportsData({ sport, dataType: 'stats', identifier: searchTerm });
}

export async function getSchedule(sport: Sport, options?: { season?: string }) {
  return getSportsData({ sport, dataType: 'schedule', season: options?.season });
}

export async function getNFLPlayerFromDb(playerName: string): Promise<NormalizedPlayer | null> {
  const dbPlayer = await prisma.sportsPlayer.findFirst({
    where: {
      sport: 'NFL',
      name: { contains: playerName, mode: 'insensitive' },
      source: 'rolling_insights',
    },
  });

  if (!dbPlayer) return null;

  const stats = await prisma.playerSeasonStats.findMany({
    where: {
      sport: 'NFL',
      playerId: dbPlayer.externalId,
      source: 'rolling_insights',
    },
    orderBy: { season: 'desc' },
  });

  return {
    id: dbPlayer.externalId,
    name: dbPlayer.name,
    position: dbPlayer.position,
    team: dbPlayer.team,
    teamId: dbPlayer.teamId,
    number: dbPlayer.number,
    height: dbPlayer.height,
    weight: dbPlayer.weight ? parseInt(dbPlayer.weight) : null,
    college: dbPlayer.college,
    dob: null,
    status: null,
    img: null,
    fantasyPoints: stats[0]?.fantasyPoints || null,
    seasonStats: stats.map((s: { stats: unknown }) => s.stats),
    source: 'rolling_insights',
  };
}

export async function getNFLTeamsFromDb(): Promise<NormalizedTeam[]> {
  const teams = await prisma.sportsTeam.findMany({
    where: { sport: 'NFL', source: 'rolling_insights' },
    orderBy: { name: 'asc' },
  });

  return teams.map(t => ({
    id: t.externalId,
    name: t.name,
    shortName: t.shortName || '',
    city: t.city || undefined,
    logo: t.logo,
    source: 'rolling_insights',
  }));
}
