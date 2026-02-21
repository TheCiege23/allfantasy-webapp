import { prisma } from './prisma';
import { normalizeTeamAbbrev } from './team-abbrev';

interface RollingInsightsToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: RollingInsightsToken | null = null;

const AUTH_URL = 'https://datafeeds.rolling-insights.com/auth/token';
const GRAPHQL_URL = 'https://datafeeds.rolling-insights.com/graphql';

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.ROLLING_INSIGHTS_CLIENT_ID;
  const clientSecret = process.env.ROLLING_INSIGHTS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Rolling Insights credentials not configured');
  }

  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Rolling Insights auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.accessToken;
}

async function graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Rolling Insights GraphQL request failed: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors?.length) {
    console.error('[RollingInsights] GraphQL errors:', JSON.stringify(result.errors));
    throw new Error(`GraphQL error: ${result.errors[0].message}`);
  }

  return result.data as T;
}

export interface RIPlayer {
  id: string;
  player: string;
  team: { id: string; team: string; abbrv: string; mascot: string } | null;
  number: number | null;
  position: string | null;
  height: string | null;
  weight: number | null;
  college: string | null;
  dob: string | null;
  img: string | null;
  positionCategory: string | null;
  status: string | null;
  DK_salary: number | null;
  regularSeason: RISeasonStats[];
  postSeason: RISeasonStats[];
}

export interface RISeasonStats {
  period: string;
  passing_yards: number | null;
  passing_touchdowns: number | null;
  passing_attempts: number | null;
  completions: number | null;
  interceptions: number | null;
  passerRating: number | null;
  rushing_yards: number | null;
  rushing_touchdowns: number | null;
  rushing_attempts: number | null;
  receptions: number | null;
  receiving_yards: number | null;
  receiving_touchdowns: number | null;
  targets: number | null;
  sacks: number | null;
  tackles: number | null;
  fumbles: number | null;
  fumbles_lost: number | null;
  DK_fantasy_points: number | null;
  DK_fantasy_points_per_game: number | null;
  games_played: number | null;
  snap_count_offense: number | null;
  snap_count_defense: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  extra_points_made: number | null;
  extra_points_attempted: number | null;
}

export interface RITeam {
  id: string;
  team: string;
  abbrv: string;
  mascot: string;
  img: string | null;
}

export interface RIScheduleGame {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  date: string;
  status: string;
  season: string;
  venue: {
    arena: string | null;
    city: string | null;
    state: string | null;
    dome: boolean | null;
  } | null;
}

const PLAYER_FIELDS = `
  id player
  team { id team abbrv mascot }
  number position height weight college dob img
  positionCategory status DK_salary
  regularSeason {
    period passing_yards passing_touchdowns passing_attempts completions
    interceptions passerRating rushing_yards rushing_touchdowns rushing_attempts
    receptions receiving_yards receiving_touchdowns targets sacks tackles
    fumbles fumbles_lost DK_fantasy_points DK_fantasy_points_per_game
    games_played snap_count_offense snap_count_defense
    field_goals_made field_goals_attempted extra_points_made extra_points_attempted
  }
  postSeason {
    period passing_yards passing_touchdowns passing_attempts completions
    interceptions passerRating rushing_yards rushing_touchdowns rushing_attempts
    receptions receiving_yards receiving_touchdowns targets sacks tackles
    fumbles fumbles_lost DK_fantasy_points DK_fantasy_points_per_game
    games_played snap_count_offense snap_count_defense
    field_goals_made field_goals_attempted extra_points_made extra_points_attempted
  }
`;

export async function fetchNFLRoster(options: {
  season?: string;
  playerName?: string;
  teamId?: string;
  limit?: number;
}): Promise<RIPlayer[]> {
  const args: string[] = [];
  if (options.season) args.push(`season: "${options.season}"`);
  if (options.playerName) args.push(`playerName: "${options.playerName}"`);
  if (options.teamId) args.push(`teamId: "${options.teamId}"`);
  if (options.limit) args.push(`limit: ${options.limit}`);

  const argsStr = args.length ? `(${args.join(', ')})` : '';
  const query = `{ nflRoster${argsStr} { ${PLAYER_FIELDS} } }`;

  const data = await graphqlQuery<{ nflRoster: RIPlayer[] }>(query);
  return data.nflRoster || [];
}

export async function fetchNFLTeams(): Promise<RITeam[]> {
  const query = `{ nflTeams { id team abbrv mascot img } }`;
  const data = await graphqlQuery<{ nflTeams: RITeam[] }>(query);
  return data.nflTeams || [];
}

export async function fetchNFLSchedule(options: {
  season?: string;
  limit?: number;
}): Promise<RIScheduleGame[]> {
  const args: string[] = [];
  if (options.season) args.push(`season: "${options.season}"`);
  if (options.limit) args.push(`limit: ${options.limit}`);

  const argsStr = args.length ? `(${args.join(', ')})` : '';
  const query = `{ nflSchedules${argsStr} { gameId awayTeam homeTeam date status season venue { arena city state dome } } }`;

  const data = await graphqlQuery<{ nflSchedules: RIScheduleGame[] }>(query);
  return data.nflSchedules || [];
}

export async function searchNFLPlayer(name: string): Promise<RIPlayer[]> {
  return fetchNFLRoster({ playerName: name, limit: 10 });
}

function getCurrentNFLSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 3) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

export async function syncNFLTeamsToDb(): Promise<number> {
  const teams = await fetchNFLTeams();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let synced = 0;
  for (const team of teams) {
    await prisma.sportsTeam.upsert({
      where: {
        sport_externalId_source: {
          sport: 'NFL',
          externalId: team.id,
          source: 'rolling_insights',
        },
      },
      update: {
        name: team.team,
        shortName: team.abbrv,
        city: team.team.replace(` ${team.mascot}`, ''),
        logo: team.img,
        fetchedAt: new Date(),
        expiresAt,
      },
      create: {
        sport: 'NFL',
        externalId: team.id,
        name: team.team,
        shortName: team.abbrv,
        city: team.team.replace(` ${team.mascot}`, ''),
        logo: team.img,
        source: 'rolling_insights',
        fetchedAt: new Date(),
        expiresAt,
      },
    });
    synced++;
  }

  return synced;
}

export async function syncNFLPlayersToDb(options?: { season?: string }): Promise<number> {
  const season = options?.season || getCurrentNFLSeason();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const teams = await fetchNFLTeams();

  let synced = 0;

  for (const team of teams) {
    const players = await fetchNFLRoster({ season, teamId: team.id });

    for (const player of players) {
      await prisma.sportsPlayer.upsert({
        where: {
          sport_externalId_source: {
            sport: 'NFL',
            externalId: player.id,
            source: 'rolling_insights',
          },
        },
        update: {
          name: player.player,
          position: player.position,
          team: normalizeTeamAbbrev(player.team?.abbrv) || null,
          teamId: player.team?.id || null,
          number: player.number,
          height: player.height,
          weight: player.weight ? String(player.weight) : null,
          college: player.college,
          imageUrl: player.img || null,
          dob: player.dob || null,
          status: player.status || null,
          fetchedAt: new Date(),
          expiresAt,
        },
        create: {
          sport: 'NFL',
          externalId: player.id,
          name: player.player,
          position: player.position,
          team: normalizeTeamAbbrev(player.team?.abbrv) || null,
          teamId: player.team?.id || null,
          number: player.number,
          height: player.height,
          weight: player.weight ? String(player.weight) : null,
          college: player.college,
          imageUrl: player.img || null,
          dob: player.dob || null,
          status: player.status || null,
          source: 'rolling_insights',
          fetchedAt: new Date(),
          expiresAt,
        },
      });

      if (player.regularSeason?.length) {
        for (const stats of player.regularSeason) {
          await prisma.playerSeasonStats.upsert({
            where: {
              sport_playerId_season_seasonType_source: {
                sport: 'NFL',
                playerId: player.id,
                season: stats.period,
                seasonType: 'regular',
                source: 'rolling_insights',
              },
            },
            update: {
              playerName: player.player,
              position: player.position,
              team: player.team?.abbrv || null,
              stats: stats as unknown as object,
              gamesPlayed: stats.games_played,
              fantasyPoints: stats.DK_fantasy_points,
              fantasyPointsPerGame: stats.DK_fantasy_points_per_game,
              fetchedAt: new Date(),
              expiresAt,
            },
            create: {
              sport: 'NFL',
              playerId: player.id,
              playerName: player.player,
              season: stats.period,
              seasonType: 'regular',
              position: player.position,
              team: player.team?.abbrv || null,
              stats: stats as unknown as object,
              gamesPlayed: stats.games_played,
              fantasyPoints: stats.DK_fantasy_points,
              fantasyPointsPerGame: stats.DK_fantasy_points_per_game,
              source: 'rolling_insights',
              fetchedAt: new Date(),
              expiresAt,
            },
          });
        }
      }

      if (player.postSeason?.length) {
        for (const stats of player.postSeason) {
          await prisma.playerSeasonStats.upsert({
            where: {
              sport_playerId_season_seasonType_source: {
                sport: 'NFL',
                playerId: player.id,
                season: stats.period,
                seasonType: 'postseason',
                source: 'rolling_insights',
              },
            },
            update: {
              playerName: player.player,
              position: player.position,
              team: player.team?.abbrv || null,
              stats: stats as unknown as object,
              gamesPlayed: stats.games_played,
              fantasyPoints: stats.DK_fantasy_points,
              fantasyPointsPerGame: stats.DK_fantasy_points_per_game,
              fetchedAt: new Date(),
              expiresAt,
            },
            create: {
              sport: 'NFL',
              playerId: player.id,
              playerName: player.player,
              season: stats.period,
              seasonType: 'postseason',
              position: player.position,
              team: player.team?.abbrv || null,
              stats: stats as unknown as object,
              gamesPlayed: stats.games_played,
              fantasyPoints: stats.DK_fantasy_points,
              fantasyPointsPerGame: stats.DK_fantasy_points_per_game,
              source: 'rolling_insights',
              fetchedAt: new Date(),
              expiresAt,
            },
          });
        }
      }

      synced++;
    }
  }

  return synced;
}

export async function syncNFLScheduleToDb(options?: { season?: string }): Promise<number> {
  const season = options?.season || getCurrentNFLSeason();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  const games = await fetchNFLSchedule({ season });

  let synced = 0;
  for (const game of games) {
    await prisma.sportsGame.upsert({
      where: {
        sport_externalId_source: {
          sport: 'NFL',
          externalId: game.gameId,
          source: 'rolling_insights',
        },
      },
      update: {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        status: game.status,
        startTime: game.date ? new Date(game.date) : null,
        venue: game.venue?.arena || null,
        season: parseInt(game.season.split('-')[0]),
        fetchedAt: new Date(),
        expiresAt,
      },
      create: {
        sport: 'NFL',
        externalId: game.gameId,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        status: game.status,
        startTime: game.date ? new Date(game.date) : null,
        venue: game.venue?.arena || null,
        season: parseInt(game.season.split('-')[0]),
        source: 'rolling_insights',
        fetchedAt: new Date(),
        expiresAt,
      },
    });
    synced++;
  }

  return synced;
}

// ── Depth Charts ──

export interface RIDepthChartPlayer {
  id: string;
  player: string;
  position: string | null;
  number: number | null;
  status: string | null;
  img: string | null;
}

export interface RIDepthChart {
  team: string;
  teamId: string;
  abbrv: string;
  positions: Record<string, RIDepthChartPlayer[]>;
}

const DEPTH_CHART_POSITIONS = [
  'QB', 'RB', 'WR', 'WR1', 'WR2', 'WR3', 'TE', 'K', 'P',
  'LT', 'LG', 'C', 'RG', 'RT', 'FB',
  'DE', 'DT', 'LB', 'CB', 'S', 'SS', 'FS',
  'EDGE', 'ILB', 'OLB', 'NT', 'DL',
  'KR', 'PR', 'LS',
];

const DEPTH_CHART_FIELDS = DEPTH_CHART_POSITIONS.map(
  (pos) => `${pos} { id player position number status img }`
).join('\n    ');

export async function fetchNFLDepthCharts(options?: {
  teamName?: string;
  season?: string;
}): Promise<RIDepthChart[]> {
  const args: string[] = [];
  if (options?.teamName) args.push(`teamName: "${options.teamName}"`);
  if (options?.season) args.push(`season: "${options.season}"`);

  const argsStr = args.length ? `(${args.join(', ')})` : '';

  const query = `{
    nflTeams${argsStr} {
      id team abbrv
      rosterByPosition {
        ${DEPTH_CHART_FIELDS}
      }
    }
  }`;

  const data = await graphqlQuery<{
    nflTeams: Array<{
      id: string;
      team: string;
      abbrv: string;
      rosterByPosition: Record<string, any[] | null> | null;
    }>;
  }>(query);

  return (data.nflTeams || []).map((t) => {
    const positions: Record<string, RIDepthChartPlayer[]> = {};
    if (t.rosterByPosition) {
      for (const [pos, players] of Object.entries(t.rosterByPosition)) {
        if (Array.isArray(players) && players.length > 0) {
          positions[pos] = players.map((p: any) => ({
            id: p.id,
            player: p.player,
            position: p.position || pos,
            number: p.number ?? null,
            status: p.status ?? null,
            img: p.img ?? null,
          }));
        }
      }
    }
    return { team: t.team, teamId: t.id, abbrv: t.abbrv, positions };
  });
}

// ── Team Season Stats ──

export interface RITeamSeasonStats {
  period: string;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  points: number | null;
  totalYards: number | null;
  passingYards: number | null;
  rushingYards: number | null;
  turnovers: number | null;
  sacks: number | null;
  firstDowns: number | null;
  penalties: number | null;
  penaltyYards: number | null;
  gamesPlayed: number | null;
  DK_fantasy_points: number | null;
  DK_fantasy_points_per_game: number | null;
  passingTouchdowns: number | null;
  rushingTouchdowns: number | null;
  defenseTouchdowns: number | null;
  defenseInterceptions: number | null;
  totalPassingYardsAllowed: number | null;
  totalRushingYardsAllowed: number | null;
  pointsAgainstDST: number | null;
}

export interface RITeamFull {
  id: string;
  team: string;
  abbrv: string;
  mascot: string;
  img: string | null;
  conf: string | null;
  city: string | null;
  state: string | null;
  arena: string | null;
  dome: boolean | null;
  bye: Array<{ period: string; value: number | null }>;
  injuries: Array<{
    injury: string | null;
    player: string | null;
    returns: string | null;
    playerId: string | null;
    date: string | null;
  }>;
  record: Array<{
    period: string;
    regular: { wins: number; losses: number; ties: number } | null;
    wildcard: { wins: number; losses: number; ties: number } | null;
  }>;
  regularSeason: RITeamSeasonStats[];
  postSeason: RITeamSeasonStats[];
}

const TEAM_SEASON_STATS_FIELDS = `
  period
  wins losses ties
  points total_yards passing_yards rushing_yards turnovers sacks
  first_downs penalties penalty_yards games_played
  DK_fantasy_points DK_fantasy_points_per_game
  passing_touchdowns rushing_touchdowns defense_touchdowns
  defense_interceptions total_passing_yards_allowed total_rushing_yards_allowed
  points_against_defense_special_teams
  offense_touchdowns receiving_touchdowns special_team_touchdowns
  safeties blocked_kicks blocked_punts
  kick_return_touchdowns punt_return_touchdowns
  interception_touchdowns fumble_return_touchdowns defense_fumble_recoveries
`;

export async function fetchNFLTeamsFull(options?: {
  teamName?: string;
  season?: string;
}): Promise<RITeamFull[]> {
  const args: string[] = [];
  if (options?.teamName) args.push(`teamName: "${options.teamName}"`);
  if (options?.season) args.push(`season: "${options.season}"`);

  const argsStr = args.length ? `(${args.join(', ')})` : '';

  const query = `{
    nflTeams${argsStr} {
      id team abbrv mascot img
      conf city state arena dome
      bye { period value }
      injuries { injury player returns playerId date }
      record { period regular { wins losses ties } wildcard { wins losses ties } }
      regularSeason { ${TEAM_SEASON_STATS_FIELDS} }
      postSeason { ${TEAM_SEASON_STATS_FIELDS} }
    }
  }`;

  const data = await graphqlQuery<{ nflTeams: any[] }>(query);

  return (data.nflTeams || []).map((t) => ({
    id: t.id,
    team: t.team,
    abbrv: t.abbrv,
    mascot: t.mascot,
    img: t.img,
    conf: t.conf ?? null,
    city: t.city ?? null,
    state: t.state ?? null,
    arena: t.arena ?? null,
    dome: t.dome ?? null,
    bye: t.bye || [],
    injuries: t.injuries || [],
    record: t.record || [],
    regularSeason: (t.regularSeason || []).map(mapTeamSeasonStats),
    postSeason: (t.postSeason || []).map(mapTeamSeasonStats),
  }));
}

function mapTeamSeasonStats(s: any): RITeamSeasonStats {
  return {
    period: s.period,
    wins: s.wins ?? null,
    losses: s.losses ?? null,
    ties: s.ties ?? null,
    points: s.points ?? null,
    totalYards: s.total_yards ?? null,
    passingYards: s.passing_yards ?? null,
    rushingYards: s.rushing_yards ?? null,
    turnovers: s.turnovers ?? null,
    sacks: s.sacks ?? null,
    firstDowns: s.first_downs ?? null,
    penalties: s.penalties ?? null,
    penaltyYards: s.penalty_yards ?? null,
    gamesPlayed: s.games_played ?? null,
    DK_fantasy_points: s.DK_fantasy_points ?? null,
    DK_fantasy_points_per_game: s.DK_fantasy_points_per_game ?? null,
    passingTouchdowns: s.passing_touchdowns ?? null,
    rushingTouchdowns: s.rushing_touchdowns ?? null,
    defenseTouchdowns: s.defense_touchdowns ?? null,
    defenseInterceptions: s.defense_interceptions ?? null,
    totalPassingYardsAllowed: s.total_passing_yards_allowed ?? null,
    totalRushingYardsAllowed: s.total_rushing_yards_allowed ?? null,
    pointsAgainstDST: s.points_against_defense_special_teams ?? null,
  };
}

// ── Enhanced Player Fields ──

export interface RIPlayerEnhanced extends RIPlayer {
  injury: {
    injury: string | null;
    returns: string | null;
    date: string | null;
  } | null;
  formerTeams: Array<{ period: string; teamNames: string[] }>;
  allStar: Array<{ period: string; count: number }>;
}

const PLAYER_ENHANCED_FIELDS = `
  id player
  team { id team abbrv mascot }
  number position height weight college dob img
  positionCategory status DK_salary
  injury { injury player returns date }
  formerTeams { period teamNames }
  allStar { period count }
  regularSeason {
    period passing_yards passing_touchdowns passing_attempts completions
    interceptions passerRating rushing_yards rushing_touchdowns rushing_attempts
    receptions receiving_yards receiving_touchdowns targets sacks tackles
    fumbles fumbles_lost DK_fantasy_points DK_fantasy_points_per_game
    games_played snap_count_offense snap_count_defense snap_count_special_teams
    field_goals_made field_goals_attempted extra_points_made extra_points_attempted
    punts punts_long punting_yards inside_20
    punt_returns punt_return_yards punt_return_touchdowns
    kick_return_touchdowns
  }
  postSeason {
    period passing_yards passing_touchdowns passing_attempts completions
    interceptions passerRating rushing_yards rushing_touchdowns rushing_attempts
    receptions receiving_yards receiving_touchdowns targets sacks tackles
    fumbles fumbles_lost DK_fantasy_points DK_fantasy_points_per_game
    games_played snap_count_offense snap_count_defense snap_count_special_teams
    field_goals_made field_goals_attempted extra_points_made extra_points_attempted
    punts punts_long punting_yards inside_20
    punt_returns punt_return_yards punt_return_touchdowns
    kick_return_touchdowns
  }
`;

export async function fetchNFLRosterEnhanced(options: {
  season?: string;
  playerName?: string;
  teamId?: string;
  limit?: number;
}): Promise<RIPlayerEnhanced[]> {
  const args: string[] = [];
  if (options.season) args.push(`season: "${options.season}"`);
  if (options.playerName) args.push(`playerName: "${options.playerName}"`);
  if (options.teamId) args.push(`teamId: "${options.teamId}"`);
  if (options.limit) args.push(`limit: ${options.limit}`);

  const argsStr = args.length ? `(${args.join(', ')})` : '';
  const query = `{ nflRoster${argsStr} { ${PLAYER_ENHANCED_FIELDS} } }`;

  const data = await graphqlQuery<{ nflRoster: RIPlayerEnhanced[] }>(query);
  return data.nflRoster || [];
}

// ── Sync Functions ──

export async function syncNFLDepthChartsToDb(options?: { season?: string }): Promise<number> {
  const season = options?.season || getCurrentNFLSeason();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  let charts: RIDepthChart[];
  try {
    charts = await fetchNFLDepthCharts({ season });
  } catch (error) {
    console.error('[RollingInsights] Failed to fetch depth charts:', error);
    return 0;
  }

  let synced = 0;
  for (const chart of charts) {
    const team = normalizeTeamAbbrev(chart.abbrv) || chart.abbrv;

    for (const [position, players] of Object.entries(chart.positions)) {
      if (!players.length) continue;

      try {
        await prisma.depthChart.upsert({
          where: {
            sport_team_position_source: {
              sport: 'NFL',
              team,
              position,
              source: 'rolling_insights',
            },
          },
          update: {
            teamId: chart.teamId,
            players: players as unknown as object,
            season,
            fetchedAt: new Date(),
            expiresAt,
          },
          create: {
            sport: 'NFL',
            team,
            teamId: chart.teamId,
            position,
            players: players as unknown as object,
            source: 'rolling_insights',
            season,
            fetchedAt: new Date(),
            expiresAt,
          },
        });
        synced++;
      } catch (err) {
        console.error(`[RollingInsights] Failed to sync depth chart ${team}/${position}:`, err);
      }
    }
  }

  console.log(`[RollingInsights] Synced ${synced} depth chart entries`);
  return synced;
}

export async function syncNFLTeamStatsToDb(options?: { season?: string }): Promise<number> {
  const season = options?.season || getCurrentNFLSeason();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let teams: RITeamFull[];
  try {
    teams = await fetchNFLTeamsFull({ season });
  } catch (error) {
    console.error('[RollingInsights] Failed to fetch team stats:', error);
    return 0;
  }

  let synced = 0;
  for (const team of teams) {
    const abbrev = normalizeTeamAbbrev(team.abbrv) || team.abbrv;

    if (team.conf || team.dome !== null || team.arena) {
      try {
        await prisma.sportsTeam.updateMany({
          where: { sport: 'NFL', shortName: abbrev, source: 'rolling_insights' },
          data: {
            conference: team.conf || undefined,
          },
        });
      } catch {}
    }

    const allStats = [
      ...team.regularSeason.map((s) => ({ ...s, type: 'regular' as const })),
      ...team.postSeason.map((s) => ({ ...s, type: 'postseason' as const })),
    ];

    for (const stats of allStats) {
      try {
        await prisma.teamSeasonStats.upsert({
          where: {
            sport_team_season_seasonType_source: {
              sport: 'NFL',
              team: abbrev,
              season: stats.period,
              seasonType: stats.type,
              source: 'rolling_insights',
            },
          },
          update: {
            teamId: team.id,
            stats: stats as unknown as object,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.points,
            totalYards: stats.totalYards,
            passingYards: stats.passingYards,
            rushingYards: stats.rushingYards,
            turnovers: stats.turnovers,
            sacks: stats.sacks,
            fantasyPoints: stats.DK_fantasy_points,
            gamesPlayed: stats.gamesPlayed,
            fetchedAt: new Date(),
            expiresAt,
          },
          create: {
            sport: 'NFL',
            team: abbrev,
            teamId: team.id,
            season: stats.period,
            seasonType: stats.type,
            stats: stats as unknown as object,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            pointsFor: stats.points,
            totalYards: stats.totalYards,
            passingYards: stats.passingYards,
            rushingYards: stats.rushingYards,
            turnovers: stats.turnovers,
            sacks: stats.sacks,
            fantasyPoints: stats.DK_fantasy_points,
            gamesPlayed: stats.gamesPlayed,
            source: 'rolling_insights',
            fetchedAt: new Date(),
            expiresAt,
          },
        });
        synced++;
      } catch (err) {
        console.error(`[RollingInsights] Failed to sync team stats ${abbrev}/${stats.period}:`, err);
      }
    }
  }

  console.log(`[RollingInsights] Synced ${synced} team season stats entries`);
  return synced;
}

export { getCurrentNFLSeason, getAccessToken as testAuth };
