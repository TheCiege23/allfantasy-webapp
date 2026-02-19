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

export interface PlayerInsight {
  playerName: string
  insight: string
  games: number
}

export async function getRollingInsights(playerIds: string[]): Promise<PlayerInsight[]> {
  if (!playerIds.length) return []

  const insights: PlayerInsight[] = []

  try {
    const season = getCurrentNFLSeason()

    const statsRows = await prisma.playerSeasonStats.findMany({
      where: {
        sport: 'NFL',
        playerId: { in: playerIds },
        season,
        seasonType: 'regular',
      },
      orderBy: { fetchedAt: 'desc' },
    })

    for (const row of statsRows) {
      const stats = row.stats as Record<string, any> | null
      if (!stats) continue

      const parts: string[] = []

      if (stats.passing_yards != null && stats.passing_yards > 0) {
        parts.push(`${stats.passing_yards} pass yds, ${stats.passing_touchdowns ?? 0} TD, ${stats.interceptions ?? 0} INT`)
      }
      if (stats.rushing_yards != null && stats.rushing_yards > 0) {
        parts.push(`${stats.rushing_yards} rush yds, ${stats.rushing_touchdowns ?? 0} rush TD`)
      }
      if (stats.receiving_yards != null && stats.receiving_yards > 0) {
        parts.push(`${stats.receptions ?? 0} rec, ${stats.receiving_yards} rec yds, ${stats.receiving_touchdowns ?? 0} rec TD`)
      }
      if (stats.DK_fantasy_points_per_game != null) {
        parts.push(`${stats.DK_fantasy_points_per_game.toFixed(1)} FPPG`)
      }

      if (parts.length) {
        insights.push({
          playerName: row.playerName || row.playerId,
          insight: parts.join(' | '),
          games: row.gamesPlayed ?? stats.games_played ?? 0,
        })
      }
    }
  } catch (err) {
    console.warn('[getRollingInsights] Failed to fetch insights, continuing without:', err)
  }

  return insights
}

export { getCurrentNFLSeason, getAccessToken as testAuth };
