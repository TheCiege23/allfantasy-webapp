import { prisma } from './prisma';
import { normalizeTeamAbbrev, normalizePosition, normalizePlayerName } from './team-abbrev';

const BASE_URL = 'https://v1.american-football.api-sports.io';

const API_SPORTS_TEAM_MAP: Record<string, string> = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
};

export function teamNameToAbbrev(name: string | null): string | null {
  if (!name) return null;
  return normalizeTeamAbbrev(API_SPORTS_TEAM_MAP[name]) || normalizeTeamAbbrev(name) || null;
}

let ipBlockedUntil = 0;
const IP_BLOCK_COOLDOWN_MS = 60 * 60 * 1000;

async function apiSportsFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) {
    throw new Error('API_SPORTS_KEY not configured');
  }

  if (Date.now() < ipBlockedUntil) {
    throw new Error('API-Sports IP blocked — skipping until cooldown expires');
  }

  const url = new URL(`${BASE_URL}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Sports request failed: ${response.status} ${response.statusText}`);
  }

  const remaining = response.headers.get('x-ratelimit-requests-remaining');
  if (remaining && parseInt(remaining) < 5) {
    console.warn(`[API-Sports] Low daily quota: ${remaining} requests remaining`);
  }

  const minuteRemaining = response.headers.get('X-RateLimit-Remaining');
  if (minuteRemaining && parseInt(minuteRemaining) < 2) {
    console.warn(`[API-Sports] Per-minute rate limit nearly hit: ${minuteRemaining} remaining, waiting 60s`);
    await new Promise(r => setTimeout(r, 60_000));
  }

  const result = await response.json();

  if (result.errors && Object.keys(result.errors).length > 0) {
    const errStr = JSON.stringify(result.errors);
    if (errStr.includes('IP is not allowed')) {
      console.warn('[API-Sports] IP blocked by API-Sports. Pausing requests for 1 hour.');
      ipBlockedUntil = Date.now() + IP_BLOCK_COOLDOWN_MS;
    }
    throw new Error(`API-Sports error: ${errStr}`);
  }

  return result.response as T;
}

export interface APISportsTeam {
  id: number;
  name: string;
  logo: string | null;
  city: string | null;
  coach: string | null;
  owner: string | null;
  stadium: string | null;
  established: number | null;
}

export interface APISportsPlayer {
  id: number;
  name: string;
  age: number | null;
  height: string | null;
  weight: string | null;
  college: string | null;
  group: string | null;
  position: string | null;
  number: number | null;
  salary: string | null;
  experience: string | null;
  image: string | null;
  team: {
    id: number;
    name: string;
    logo: string | null;
  } | null;
}

export interface APISportsInjury {
  id: number;
  player: {
    id: number;
    name: string;
    image: string | null;
  };
  team: {
    id: number;
    name: string;
    logo: string | null;
  };
  status: string | null;
  date: string | null;
  description: string | null;
  type: string | null;
}

export interface APISportsGame {
  game: {
    id: number;
    stage: string | null;
    week: string | null;
    date: {
      date: string | null;
      time: string | null;
      timestamp: number | null;
    };
    venue: {
      name: string | null;
      city: string | null;
    } | null;
    status: {
      short: string | null;
      long: string | null;
    };
  };
  league: {
    id: number;
    name: string;
    season: string | null;
  };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  scores: {
    home: { total: number | null };
    away: { total: number | null };
  };
}

export interface APISportsStanding {
  team: {
    id: number;
    name: string;
    logo: string | null;
  };
  position: number;
  won: number;
  lost: number;
  tied: number;
  points: { for: number; against: number };
  group: {
    name: string;
    conference: string | null;
  };
}

export async function fetchAPISportsTeams(): Promise<APISportsTeam[]> {
  const data = await apiSportsFetch<APISportsTeam[]>('teams', { league: '1' });
  return data || [];
}

export async function fetchAPISportsPlayers(teamId: string, season: string): Promise<APISportsPlayer[]> {
  const data = await apiSportsFetch<APISportsPlayer[]>('players', {
    team: teamId,
    season,
  });
  return data || [];
}

export async function fetchAPISportsPlayerBySearch(search: string, season?: string): Promise<APISportsPlayer[]> {
  const params: Record<string, string> = { search, league: '1' };
  if (season) params.season = season;
  const data = await apiSportsFetch<APISportsPlayer[]>('players', params);
  return data || [];
}

export async function fetchAPISportsInjuries(season: string): Promise<APISportsInjury[]> {
  const data = await apiSportsFetch<APISportsInjury[]>('injuries', {
    league: '1',
    season,
  });
  return data || [];
}

export async function fetchAPISportsInjuriesByTeam(teamId: string, season: string): Promise<APISportsInjury[]> {
  const data = await apiSportsFetch<APISportsInjury[]>('injuries', {
    team: teamId,
    season,
  });
  return data || [];
}

export async function fetchAPISportsGames(season: string): Promise<APISportsGame[]> {
  const data = await apiSportsFetch<APISportsGame[]>('games', {
    league: '1',
    season,
  });
  return data || [];
}

export async function fetchAPISportsGamesByWeek(season: string, week: string): Promise<APISportsGame[]> {
  const data = await apiSportsFetch<APISportsGame[]>('games', {
    league: '1',
    season,
    week,
  });
  return data || [];
}

export async function fetchAPISportsLiveGames(): Promise<APISportsGame[]> {
  const data = await apiSportsFetch<APISportsGame[]>('games', {
    league: '1',
    live: 'all',
  });
  return data || [];
}

export async function fetchAPISportsStandings(season: string, opts?: { conference?: string; division?: string }): Promise<APISportsStanding[]> {
  const params: Record<string, string> = { league: '1', season };
  if (opts?.conference) params.conference = opts.conference;
  if (opts?.division) params.division = opts.division;
  const data = await apiSportsFetch<APISportsStanding[]>('standings', params);
  return data || [];
}

export interface APISportsConference {
  id: number;
  name: string;
  league: { id: number; name: string; season: string };
}

export interface APISportsDivision {
  id: number;
  name: string;
  conference: { id: number; name: string };
  league: { id: number; name: string; season: string };
}

export async function fetchAPISportsConferences(season: string): Promise<APISportsConference[]> {
  const data = await apiSportsFetch<APISportsConference[]>('standings/conferences', {
    league: '1',
    season,
  });
  return data || [];
}

export async function fetchAPISportsDivisions(season: string): Promise<APISportsDivision[]> {
  const data = await apiSportsFetch<APISportsDivision[]>('standings/divisions', {
    league: '1',
    season,
  });
  return data || [];
}

export interface APISportsPlayerStatistics {
  player: { id: number; name: string; image: string | null };
  teams: Array<{
    team: { id: number; name: string; logo: string | null };
    groups: Array<{
      name: string;
      statistics: Array<{ name: string; value: string | number | null }>;
    }>;
  }>;
}

export async function fetchAPISportsPlayerStatistics(playerId: string, season: string): Promise<APISportsPlayerStatistics[]> {
  const data = await apiSportsFetch<APISportsPlayerStatistics[]>('players/statistics', {
    id: playerId,
    season,
  });
  return data || [];
}

export interface APISportsGameEvent {
  quarter: number | null;
  minute: string | null;
  team: { id: number; name: string; logo: string | null } | null;
  player: { id: number; name: string } | null;
  type: string | null;
  comment: string | null;
}

export async function fetchAPISportsGameEvents(gameId: string): Promise<APISportsGameEvent[]> {
  const data = await apiSportsFetch<APISportsGameEvent[]>('games/events', {
    id: gameId,
  });
  return data || [];
}

export interface APISportsGameTeamStats {
  team: { id: number; name: string; logo: string | null };
  statistics: Array<{ name: string; value: string | number | null }>;
}

export async function fetchAPISportsGameTeamStats(gameId: string): Promise<APISportsGameTeamStats[]> {
  const data = await apiSportsFetch<APISportsGameTeamStats[]>('games/statistics/teams', {
    id: gameId,
  });
  return data || [];
}

export interface APISportsGamePlayerStats {
  team: { id: number; name: string; logo: string | null };
  groups: Array<{
    name: string;
    players: Array<{
      player: { id: number; name: string };
      statistics: Array<{ name: string; value: string | number | null }>;
    }>;
  }>;
}

export async function fetchAPISportsGamePlayerStats(gameId: string): Promise<APISportsGamePlayerStats[]> {
  const data = await apiSportsFetch<APISportsGamePlayerStats[]>('games/statistics/players', {
    id: gameId,
  });
  return data || [];
}

export interface APISportsOdds {
  league: { id: number; name: string; season: string };
  game: { id: number; date: string };
  bookmakers: Array<{
    id: number;
    name: string;
    bets: Array<{
      id: number;
      name: string;
      values: Array<{ value: string; odd: string }>;
    }>;
  }>;
}

export async function fetchAPISportsOdds(gameId: string): Promise<APISportsOdds[]> {
  const data = await apiSportsFetch<APISportsOdds[]>('odds', {
    game: gameId,
  });
  return data || [];
}

export async function fetchAPISportsOddsBySeasonWeek(season: string, opts?: { bookmaker?: string }): Promise<APISportsOdds[]> {
  const params: Record<string, string> = { league: '1', season };
  if (opts?.bookmaker) params.bookmaker = opts.bookmaker;
  const data = await apiSportsFetch<APISportsOdds[]>('odds', params);
  return data || [];
}

export interface APISportsBookmaker {
  id: number;
  name: string;
}

export async function fetchAPISportsBookmakers(): Promise<APISportsBookmaker[]> {
  const data = await apiSportsFetch<APISportsBookmaker[]>('odds/bookmakers');
  return data || [];
}

export interface APISportsBetType {
  id: number;
  name: string;
}

export async function fetchAPISportsBetTypes(): Promise<APISportsBetType[]> {
  const data = await apiSportsFetch<APISportsBetType[]>('odds/bets');
  return data || [];
}

export interface APISportsLeague {
  id: number;
  name: string;
  season: string | null;
  logo: string | null;
  country: { name: string; code: string | null; flag: string | null } | null;
}

export async function fetchAPISportsLeagues(): Promise<APISportsLeague[]> {
  const data = await apiSportsFetch<APISportsLeague[]>('leagues');
  return data || [];
}

export async function fetchAPISportsSeasons(): Promise<number[]> {
  const data = await apiSportsFetch<number[]>('seasons');
  return data || [];
}

export async function fetchAPISportsTimezones(): Promise<string[]> {
  const data = await apiSportsFetch<string[]>('timezone');
  return data || [];
}

export async function fetchAPISportsGamesByDate(date: string): Promise<APISportsGame[]> {
  const data = await apiSportsFetch<APISportsGame[]>('games', {
    league: '1',
    date,
  });
  return data || [];
}

export async function fetchAPISportsH2H(team1Id: string, team2Id: string): Promise<APISportsGame[]> {
  const data = await apiSportsFetch<APISportsGame[]>('games', {
    h2h: `${team1Id}-${team2Id}`,
  });
  return data || [];
}

export async function fetchAPISportsGamesByTeam(teamId: string, season: string): Promise<APISportsGame[]> {
  const data = await apiSportsFetch<APISportsGame[]>('games', {
    league: '1',
    season,
    team: teamId,
  });
  return data || [];
}

export function getCurrentNFLSeasonForAPISports(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 3 ? String(year) : String(year - 1);
}

export async function syncAPISportsInjuriesToDb(season?: string): Promise<number> {
  const currentSeason = season || getCurrentNFLSeasonForAPISports();
  let injuries: APISportsInjury[];

  try {
    injuries = await fetchAPISportsInjuries(currentSeason);
  } catch (error) {
    console.error('[API-Sports] Failed to fetch injuries:', error);
    return 0;
  }

  let synced = 0;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  for (const injury of injuries) {
    const team = teamNameToAbbrev(injury.team?.name || null);

    try {
      await prisma.sportsInjury.upsert({
        where: {
          sport_externalId_source: {
            sport: 'NFL',
            externalId: String(injury.id),
            source: 'api_sports',
          },
        },
        update: {
          playerName: injury.player.name,
          playerId: String(injury.player.id),
          team,
          teamId: injury.team ? String(injury.team.id) : null,
          type: injury.type,
          status: injury.status,
          description: injury.description,
          date: injury.date ? new Date(injury.date) : null,
          season: parseInt(currentSeason),
          fetchedAt: now,
          expiresAt,
        },
        create: {
          sport: 'NFL',
          externalId: String(injury.id),
          playerName: injury.player.name,
          playerId: String(injury.player.id),
          team,
          teamId: injury.team ? String(injury.team.id) : null,
          type: injury.type,
          status: injury.status,
          description: injury.description,
          date: injury.date ? new Date(injury.date) : null,
          season: parseInt(currentSeason),
          source: 'api_sports',
          fetchedAt: now,
          expiresAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[API-Sports] Failed to sync injury for ${injury.player.name}:`, err);
    }
  }

  console.log(`[API-Sports] Synced ${synced}/${injuries.length} injuries`);
  return synced;
}

export async function syncAPISportsTeamsToDb(): Promise<number> {
  let teams: APISportsTeam[];

  try {
    teams = await fetchAPISportsTeams();
  } catch (error) {
    console.error('[API-Sports] Failed to fetch teams:', error);
    return 0;
  }

  let synced = 0;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const team of teams) {
    const abbrev = teamNameToAbbrev(team.name);

    try {
      await prisma.sportsTeam.upsert({
        where: {
          sport_externalId_source: {
            sport: 'NFL',
            externalId: String(team.id),
            source: 'api_sports',
          },
        },
        update: {
          name: team.name,
          shortName: abbrev,
          city: team.city,
          logo: team.logo,
          fetchedAt: now,
          expiresAt,
        },
        create: {
          sport: 'NFL',
          externalId: String(team.id),
          name: team.name,
          shortName: abbrev,
          city: team.city,
          logo: team.logo,
          source: 'api_sports',
          fetchedAt: now,
          expiresAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[API-Sports] Failed to sync team ${team.name}:`, err);
    }
  }

  console.log(`[API-Sports] Synced ${synced}/${teams.length} teams`);
  return synced;
}

export async function syncAPISportsGamesToDb(season?: string): Promise<number> {
  const currentSeason = season || getCurrentNFLSeasonForAPISports();
  let games: APISportsGame[];

  try {
    games = await fetchAPISportsGames(currentSeason);
  } catch (error) {
    console.error('[API-Sports] Failed to fetch games:', error);
    return 0;
  }

  let synced = 0;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 1000);

  for (const g of games) {
    const homeTeam = teamNameToAbbrev(g.teams.home.name) || g.teams.home.name;
    const awayTeam = teamNameToAbbrev(g.teams.away.name) || g.teams.away.name;
    const weekNum = g.game.week ? parseInt(g.game.week.replace(/\D/g, '')) || null : null;

    try {
      await prisma.sportsGame.upsert({
        where: {
          sport_externalId_source: {
            sport: 'NFL',
            externalId: String(g.game.id),
            source: 'api_sports',
          },
        },
        update: {
          homeTeam,
          awayTeam,
          homeTeamId: String(g.teams.home.id),
          awayTeamId: String(g.teams.away.id),
          homeScore: g.scores.home.total,
          awayScore: g.scores.away.total,
          status: g.game.status.long,
          startTime: g.game.date.timestamp ? new Date(g.game.date.timestamp * 1000) : null,
          venue: g.game.venue?.name || null,
          week: weekNum,
          season: g.league.season ? parseInt(g.league.season) : null,
          fetchedAt: now,
          expiresAt,
        },
        create: {
          sport: 'NFL',
          externalId: String(g.game.id),
          homeTeam,
          awayTeam,
          homeTeamId: String(g.teams.home.id),
          awayTeamId: String(g.teams.away.id),
          homeScore: g.scores.home.total,
          awayScore: g.scores.away.total,
          status: g.game.status.long,
          startTime: g.game.date.timestamp ? new Date(g.game.date.timestamp * 1000) : null,
          venue: g.game.venue?.name || null,
          week: weekNum,
          season: g.league.season ? parseInt(g.league.season) : null,
          source: 'api_sports',
          fetchedAt: now,
          expiresAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[API-Sports] Failed to sync game ${g.game.id}:`, err);
    }
  }

  console.log(`[API-Sports] Synced ${synced}/${games.length} games`);
  return synced;
}

export async function syncAPISportsPlayersToIdentityMap(season?: string): Promise<{ linked: number; created: number }> {
  const currentSeason = season || getCurrentNFLSeasonForAPISports();
  let linked = 0;
  let created = 0;

  const teams = await prisma.sportsTeam.findMany({
    where: { sport: 'NFL', source: 'api_sports' },
    select: { externalId: true, shortName: true, name: true },
  });

  for (const team of teams) {
    let players: APISportsPlayer[];
    try {
      players = await fetchAPISportsPlayers(team.externalId, currentSeason);
    } catch (err) {
      console.error(`[API-Sports] Failed to fetch players for ${team.name}:`, err);
      continue;
    }

    for (const p of players) {
      const normalizedName = normalizePlayerName(p.name);
      const position = normalizePosition(p.position || p.group);
      const teamAbbrev = teamNameToAbbrev(p.team?.name || team.name);

      const candidates = await prisma.playerIdentityMap.findMany({
        where: { normalizedName, sport: 'NFL' },
      });

      if (candidates.length === 1) {
        await prisma.playerIdentityMap.update({
          where: { id: candidates[0].id },
          data: {
            apiSportsId: String(p.id),
            lastSyncedAt: new Date(),
          },
        });
        linked++;
      } else if (candidates.length > 1) {
        const match = candidates.find((c: { position: string | null; currentTeam: string | null }) => {
          const posMatch = !position || !c.position || normalizePosition(c.position) === position;
          const teamMatch = !teamAbbrev || !c.currentTeam || normalizeTeamAbbrev(c.currentTeam) === teamAbbrev;
          return posMatch && teamMatch;
        });
        if (match) {
          await prisma.playerIdentityMap.update({
            where: { id: match.id },
            data: {
              apiSportsId: String(p.id),
              lastSyncedAt: new Date(),
            },
          });
          linked++;
        } else {
          console.warn(`[API-Sports] Ambiguous identity for ${p.name} (${position} ${teamAbbrev}), skipping.`);
        }
      } else {
        await prisma.playerIdentityMap.create({
          data: {
            canonicalName: p.name,
            normalizedName,
            position,
            currentTeam: teamAbbrev,
            apiSportsId: String(p.id),
            sport: 'NFL',
            lastSyncedAt: new Date(),
          },
        });
        created++;
      }
    }
  }

  console.log(`[API-Sports] Identity sync: ${linked} linked, ${created} created`);
  return { linked, created };
}

export async function syncAPISportsStandingsToDb(season?: string): Promise<number> {
  const currentSeason = season || getCurrentNFLSeasonForAPISports();
  let standings: APISportsStanding[];

  try {
    standings = await fetchAPISportsStandings(currentSeason);
  } catch (error) {
    console.error('[API-Sports] Failed to fetch standings:', error);
    return 0;
  }

  let synced = 0;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  for (const s of standings) {
    const teamAbbrev = teamNameToAbbrev(s.team.name) || s.team.name;

    try {
      const key = `NFL:standings:${currentSeason}:${teamAbbrev}`;
      await (prisma.sportsDataCache as any).upsert({
        where: { key },
        update: {
          data: {
            team: teamAbbrev,
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
            season: currentSeason,
          } as object,
          expiresAt,
        },
        create: {
          key,
          data: {
            team: teamAbbrev,
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
            season: currentSeason,
          } as object,
          expiresAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[API-Sports] Failed to sync standing for ${s.team.name}:`, err);
    }
  }

  console.log(`[API-Sports] Synced ${synced}/${standings.length} standings`);
  return synced;
}

export async function getAPISportsGameDetail(gameId: string): Promise<{
  events: APISportsGameEvent[];
  teamStats: APISportsGameTeamStats[];
  playerStats: APISportsGamePlayerStats[];
}> {
  const [events, teamStats, playerStats] = await Promise.all([
    fetchAPISportsGameEvents(gameId).catch(() => [] as APISportsGameEvent[]),
    fetchAPISportsGameTeamStats(gameId).catch(() => [] as APISportsGameTeamStats[]),
    fetchAPISportsGamePlayerStats(gameId).catch(() => [] as APISportsGamePlayerStats[]),
  ]);

  return { events, teamStats, playerStats };
}
