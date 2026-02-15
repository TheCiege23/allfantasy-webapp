import type {
  EngineLeagueContext,
  EngineManagerProfile,
  EngineAsset,
  EngineContext,
} from './types'
import {
  normalizeLeagueContext,
  normalizePlayerState,
  normalizeManagerProfile,
  normalizeAssetFromPlayer,
  normalizeAssetFromPick,
  buildEngineContext,
} from './normalize'

interface SleeperLeagueRaw {
  league_id: string
  name?: string
  season?: string
  settings?: any
  scoring_settings?: any
  roster_positions?: string[]
  status?: string
}

interface SleeperRosterRaw {
  roster_id: number
  owner_id: string | null
  players?: string[] | null
  starters?: string[] | null
  reserve?: string[] | null
  taxi?: string[] | null
  settings?: any
}

interface SleeperUserRaw {
  user_id: string
  display_name?: string
  username?: string
  avatar?: string
}

export async function buildContextFromSleeper(
  league: SleeperLeagueRaw,
  rosters: SleeperRosterRaw[],
  users: SleeperUserRaw[],
  playerDb: Record<string, any>,
  options?: {
    valueLookup?: Record<string, number>
    draftPicks?: Record<number, Array<{ season: string; round: number; originalOwnerId: string }>>
  }
): Promise<EngineContext> {
  const engineLeague = normalizeLeagueContext({
    league_id: league.league_id,
    name: league.name,
    season: league.season,
    settings: league.settings,
    scoring_settings: league.scoring_settings,
    roster_positions: league.roster_positions,
    status: league.status,
    numTeams: rosters.length || league.settings?.num_teams,
  })

  const userMap: Record<string, any> = {}
  for (const u of users) {
    userMap[u.user_id] = u
  }

  const managers: Record<number, EngineManagerProfile> = {}

  for (const roster of rosters) {
    const rosterPlayers = roster.players || []
    const starters = new Set(roster.starters || [])
    const taxi = new Set(roster.taxi || [])
    const reserve = new Set(roster.reserve || [])

    const assets: EngineAsset[] = []

    for (const playerId of rosterPlayers) {
      const playerInfo = playerDb[playerId]
      if (!playerInfo) continue

      let slot: string = 'Bench'
      if (starters.has(playerId)) slot = 'Starter'
      else if (taxi.has(playerId)) slot = 'Taxi'
      else if (reserve.has(playerId)) slot = 'IR'

      const playerState = normalizePlayerState({
        player_id: playerId,
        full_name: playerInfo.full_name || `${playerInfo.first_name || ''} ${playerInfo.last_name || ''}`.trim(),
        position: playerInfo.position,
        team: playerInfo.team,
        age: playerInfo.age,
        years_exp: playerInfo.years_exp,
        injury_status: playerInfo.injury_status,
        value: options?.valueLookup?.[playerInfo.full_name || playerId] ?? 0,
        slot,
      })

      const asset = normalizeAssetFromPlayer(playerState, slot)
      assets.push(asset)
    }

    const rosterPicks = options?.draftPicks?.[roster.roster_id] || []
    for (const pick of rosterPicks) {
      const pickAsset = normalizeAssetFromPick({
        round: pick.round,
        year: parseInt(pick.season) || new Date().getFullYear() + 1,
      })
      assets.push(pickAsset)
    }

    const profile = normalizeManagerProfile(
      {
        roster_id: roster.roster_id,
        owner_id: roster.owner_id,
        settings: roster.settings,
      },
      userMap,
      assets
    )

    managers[roster.roster_id] = profile
  }

  return buildEngineContext(engineLeague, managers)
}

export function buildContextFromExisting(
  league: EngineLeagueContext,
  managers: Record<number, EngineManagerProfile>
): EngineContext {
  return buildEngineContext(league, managers)
}
