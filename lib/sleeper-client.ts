const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  status: string;
  total_rosters: number;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  settings: Record<string, unknown>;
  draft_id: string;
  previous_league_id: string | null;
}

export async function getLeagueHistory(leagueId: string, userIdentifier?: string): Promise<SleeperLeague[]> {
  const history: SleeperLeague[] = [];
  const seenLeagueIds = new Set<string>();
  let currentLeagueId: string | null = leagueId;
  
  // First, follow the previous_league_id chain
  while (currentLeagueId) {
    const league = await getLeagueInfo(currentLeagueId);
    if (!league) break;
    history.push(league);
    seenLeagueIds.add(league.league_id);
    currentLeagueId = league.previous_league_id;
  }
  
  // If we have a user identifier (username or numeric ID), try to find more history by name matching
  if (userIdentifier && history.length > 0) {
    const resolvedUser = await resolveSleeperUser(userIdentifier);
    
    if (resolvedUser?.userId) {
      const leagueName = history[0].name;
      const sport = history[0].sport || 'nfl';
      const currentYear = new Date().getFullYear();
      const oldestSeasonFound = Math.min(...history.map(h => parseInt(h.season)));
      
      // Search back up to 10 years for matching leagues
      for (let year = oldestSeasonFound - 1; year >= currentYear - 10; year--) {
        try {
          const userLeagues = await getUserLeagues(resolvedUser.userId, sport, year.toString());
          
          // Find leagues with similar names (exact match or contains the core name)
          const matchingLeague = userLeagues.find(l => {
            if (seenLeagueIds.has(l.league_id)) return false;
            const normalizedHistoryName = leagueName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedLeagueName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalizedHistoryName === normalizedLeagueName || 
                   normalizedHistoryName.includes(normalizedLeagueName) ||
                   normalizedLeagueName.includes(normalizedHistoryName);
          });
          
          if (matchingLeague) {
            history.push(matchingLeague);
            seenLeagueIds.add(matchingLeague.league_id);
          }
        } catch {
          // Ignore errors for older seasons that may not exist
          break;
        }
      }
      
      // Sort by season descending
      history.sort((a, b) => parseInt(b.season) - parseInt(a.season));
    }
  }
  
  return history;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  starters: string[];
  reserve: string[];
  taxi: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
    ppts?: number;
    ppts_decimal?: number;
    rank?: number;
    final_rank?: number;
  };
}

export interface SleeperMatchup {
  matchup_id: number;
  roster_id: number;
  points: number;
  starters: string[];
  starters_points: number[];
  players: string[];
  players_points: Record<string, number>;
}

export interface SleeperPlayoffBracket {
  r: number;
  m: number;
  t1: number;
  t2: number;
  w: number;
  l: number;
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
}

export async function getSleeperUser(username: string): Promise<SleeperUser | null> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/user/${username}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Helper function that accepts either username or numeric user_id and returns both
// This ensures consistency across all legacy features
export async function resolveSleeperUser(userIdentifier: string): Promise<{ username: string; userId: string } | null> {
  try {
    // The Sleeper API accepts both username and user_id in the same endpoint
    const response = await fetch(`${SLEEPER_API_BASE}/user/${userIdentifier}`);
    if (!response.ok) return null;
    const user = await response.json() as SleeperUser;
    if (!user?.user_id || !user?.username) return null;
    return {
      username: user.username,
      userId: user.user_id
    };
  } catch {
    return null;
  }
}

export async function getUserLeagues(
  userId: string,
  sport: string = 'nfl',
  season: string
): Promise<SleeperLeague[]> {
  const url = `${SLEEPER_API_BASE}/user/${userId}/leagues/${sport}/${season}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Sleeper getUserLeagues failed (${response.status}) for ${sport} ${season}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Sleeper getUserLeagues invalid JSON for ${sport} ${season}`);
  }

  return data as SleeperLeague[];
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/rosters`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/users`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function getLeagueMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/matchups/${week}`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function getPlayoffBracket(leagueId: string): Promise<SleeperPlayoffBracket[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/winners_bracket`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function getLeagueInfo(leagueId: string): Promise<SleeperLeague | null> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function getScoringType(scoringSettings: Record<string, number>): string {
  const ppr = scoringSettings['rec'] || 0;
  if (ppr >= 1) return 'PPR';
  if (ppr >= 0.5) return 'Half PPR';
  return 'Standard';
}

export function getLeagueType(league: SleeperLeague): string {
  const settings = league.settings as Record<string, unknown>;
  if (settings['type'] === 2) return 'dynasty';
  if (settings['type'] === 1) return 'keeper';
  return 'redraft';
}

export interface SleeperDraftPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export async function getTradedDraftPicks(leagueId: string): Promise<SleeperDraftPick[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/traded_picks`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function getLeagueDrafts(leagueId: string): Promise<any[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/drafts`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string | null;
  status: string;
  years_exp?: number;
  age?: number;
  college?: string;
}

let cachedPlayers: Record<string, SleeperPlayer> | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  // Return cached data if still valid
  if (cachedPlayers && Date.now() - cacheTime < CACHE_TTL) {
    return cachedPlayers;
  }
  
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`);
    if (!response.ok) return cachedPlayers || {};
    const data = await response.json();
    cachedPlayers = data;
    cacheTime = Date.now();
    return data;
  } catch {
    return cachedPlayers || {};
  }
}

export function getPlayerName(players: Record<string, SleeperPlayer>, playerId: string): string {
  const player = players[playerId];
  if (!player) return playerId;
  return player.full_name || `${player.first_name} ${player.last_name}` || playerId;
}

export interface SleeperTransaction {
  type: 'trade' | 'waiver' | 'free_agent' | 'commissioner';
  transaction_id: string;
  status: string;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: Array<{
    season: string;
    round: number;
    roster_id: number;
    previous_owner_id: number;
    owner_id: number;
  }>;
  waiver_budget: Array<{
    sender: number;
    receiver: number;
    amount: number;
  }>;
  leg: number;
  created: number;
  creator: string;
  consenter_ids: number[];
  status_updated: number;
  metadata?: Record<string, unknown>;
}

export async function getLeagueTransactions(
  leagueId: string,
  week: number
): Promise<SleeperTransaction[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}/transactions/${week}`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function getAllLeagueTrades(
  leagueId: string,
  totalWeeks: number = 18
): Promise<SleeperTransaction[]> {
  const allTrades: SleeperTransaction[] = [];
  
  for (let week = 1; week <= totalWeeks; week++) {
    const transactions = await getLeagueTransactions(leagueId, week);
    const trades = transactions.filter(t => t.type === 'trade');
    allTrades.push(...trades);
  }
  
  return allTrades.sort((a, b) => b.created - a.created);
}

export interface LeagueSeasonHistory {
  season: string;
  leagueId: string;
  name: string;
  champion: string | null;
}

export async function getLeagueHistoryChain(
  leagueId: string,
  maxDepth: number = 3
): Promise<LeagueSeasonHistory[]> {
  const history: LeagueSeasonHistory[] = [];
  let currentId: string | null = leagueId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const league = await getLeagueInfo(currentId);
    if (!league) break;

    history.push({
      season: league.season,
      leagueId: currentId,
      name: league.name,
      champion: await inferChampion(currentId, league.season),
    });

    currentId = league.previous_league_id || null;
    depth++;
  }

  return history.reverse();
}

async function inferChampion(
  leagueId: string,
  season: string
): Promise<string | null> {
  try {
    const bracket = await getPlayoffBracket(leagueId);
    if (bracket.length > 0) {
      const finalRound = Math.max(...bracket.map((m) => m.r));
      const championship = bracket.find((m) => m.r === finalRound && m.m === 1);
      if (championship?.w) {
        const rosters = await getLeagueRosters(leagueId);
        const users = await getLeagueUsers(leagueId);
        const winningRoster = rosters.find(
          (r) => r.roster_id === championship.w
        );
        if (winningRoster?.owner_id) {
          const winner = users.find(
            (u) => u.user_id === winningRoster.owner_id
          );
          return winner?.display_name || winner?.username || null;
        }
      }
    }
  } catch {}

  try {
    const finalWeek = parseInt(season) >= 2021 ? 18 : 17;
    const matchups = await getLeagueMatchups(leagueId, finalWeek);
    if (matchups.length > 0) {
      const topScorer = matchups.reduce((best, m) =>
        m.points > best.points ? m : best
      );
      const rosters = await getLeagueRosters(leagueId);
      const users = await getLeagueUsers(leagueId);
      const roster = rosters.find(
        (r) => r.roster_id === topScorer.roster_id
      );
      if (roster?.owner_id) {
        const user = users.find((u) => u.user_id === roster.owner_id);
        return user?.display_name || user?.username || null;
      }
    }
  } catch {}

  return null;
}
