// ============================================
// SLEEPER → ASSET[] CONVERTER
// ============================================
// Converts Sleeper API data to trade engine Asset format.

import {
  Asset,
  LeagueSettings,
  Thresholds,
  DEFAULT_THRESHOLDS,
  PickProjected
} from './types'

import { 
  classifyCornerstone, 
  isIdpPos,
  inferPickProjection,
  estimatePickValue
} from './league-intelligence'

// ============================================
// INPUT TYPES (from Sleeper API)
// ============================================

export interface SleeperPlayer {
  id: string
  name: string
  pos: string
  team?: string
  slot: 'Starter' | 'Bench' | 'IR' | 'Taxi'
  isIdp?: boolean
  age?: number
}

export interface SleeperDraftPick {
  season: string
  round: number
  originalOwnerId: string
  isOwnPick: boolean
  displayName: string
}

export interface SleeperRoster {
  rosterId: number
  userId: string
  username: string
  displayName: string
  avatar?: string
  record: { wins: number; losses: number; ties?: number }
  pointsFor: number
  players: SleeperPlayer[]
  picks: SleeperDraftPick[]
  faabRemaining?: number
}

export interface FantasyCalcPlayerValue {
  name: string
  value: number
  overallRank?: number
  positionRank?: number
  trend30Day?: number
  redraftValue?: number
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function safeId(prefix: string, parts: Array<string | number | undefined | null>): string {
  const s = parts.filter(Boolean).join('_')
  return `${prefix}:${s}`
}

function parseRoundFromDisplayName(displayName: string): number | undefined {
  const match = displayName.match(/\b(1st|2nd|3rd|4th)\b/i)
  if (!match) return undefined
  
  const roundStr = match[1].toLowerCase()
  return roundStr === '1st' ? 1 :
         roundStr === '2nd' ? 2 :
         roundStr === '3rd' ? 3 :
         roundStr === '4th' ? 4 : undefined
}

// ============================================
// MAIN CONVERTER
// ============================================

export interface ConvertSleeperInput {
  settings: LeagueSettings
  rosters: SleeperRoster[]
  fantasyCalcValues: Record<string, FantasyCalcPlayerValue>
  thresholds?: Thresholds
  teamRankByRosterId?: Record<number, number>
}

export interface ConvertSleeperOutput {
  assetsByRosterId: Record<number, Asset[]>
  assetsByManagerId: Record<string, Asset[]>
  allAssets: Asset[]
  stats: {
    totalPlayers: number
    totalPicks: number
    totalFaab: number
    cornerstones: number
  }
}

export function convertSleeperToAssets(input: ConvertSleeperInput): ConvertSleeperOutput {
  const {
    settings,
    rosters,
    fantasyCalcValues,
    thresholds = DEFAULT_THRESHOLDS,
    teamRankByRosterId = {}
  } = input

  const assetsByRosterId: Record<number, Asset[]> = {}
  const assetsByManagerId: Record<string, Asset[]> = {}
  const allAssets: Asset[] = []

  let totalPlayers = 0
  let totalPicks = 0
  let totalFaab = 0
  let cornerstones = 0

  const currentYear = new Date().getFullYear()

  for (const roster of rosters) {
    const assets: Asset[] = []
    const teamRank = teamRankByRosterId[roster.rosterId] || Math.ceil(settings.numTeams / 2)

    for (const player of roster.players) {
      const normalizedName = player.name.toLowerCase().trim()
      const fcValue = fantasyCalcValues[normalizedName]
      const value = fcValue?.value || 200

      const tags: string[] = []
      if (player.slot === 'Starter') tags.push('starter')
      if (player.slot === 'Bench') tags.push('bench')
      if (player.slot === 'IR') tags.push('ir')
      if (player.slot === 'Taxi') tags.push('taxi')
      if (isIdpPos(player.pos)) tags.push('idp')

      let asset: Asset = {
        id: safeId('player', [player.id]),
        type: 'PLAYER',
        value,
        name: player.name,
        pos: player.pos,
        team: player.team,
        age: player.age,
        slot: player.slot,
        tags
      }

      asset = classifyCornerstone(asset, settings, thresholds)
      
      if (asset.isCornerstone) cornerstones++
      totalPlayers++
      assets.push(asset)
    }

    for (const pick of roster.picks) {
      const season = parseInt(pick.season, 10)
      const seasonOffset = season - currentYear
      const round = pick.round || parseRoundFromDisplayName(pick.displayName)
      
      const projected = pick.isOwnPick 
        ? inferPickProjection(teamRank, settings.numTeams)
        : 'unknown'

      const value = round ? estimatePickValue(round, projected, seasonOffset) : 500

      const tags: string[] = []
      if (!pick.isOwnPick) tags.push('acquired')
      if (projected === 'early') tags.push('early')
      if (projected === 'late') tags.push('late')

      let asset: Asset = {
        id: safeId('pick', [pick.season, pick.displayName]),
        type: 'PICK',
        value,
        pickSeason: season,
        round: round as 1 | 2 | 3 | 4 | undefined,
        projected,
        displayName: pick.displayName,
        tags
      }

      asset = classifyCornerstone(asset, settings, thresholds)
      
      if (asset.isCornerstone) cornerstones++
      totalPicks++
      assets.push(asset)
    }

    if (roster.faabRemaining !== undefined && roster.faabRemaining > 0) {
      const faabValue = Math.round(roster.faabRemaining * 20)
      
      const asset: Asset = {
        id: safeId('faab', [roster.rosterId]),
        type: 'FAAB',
        value: faabValue,
        faabAmount: roster.faabRemaining,
        isCornerstone: false,
        cornerstoneReason: '',
        tags: ['faab_balancer']
      }

      totalFaab++
      assets.push(asset)
    }

    assetsByRosterId[roster.rosterId] = assets
    assetsByManagerId[roster.userId] = assets
    allAssets.push(...assets)
  }

  return {
    assetsByRosterId,
    assetsByManagerId,
    allAssets,
    stats: {
      totalPlayers,
      totalPicks,
      totalFaab,
      cornerstones
    }
  }
}

// ============================================
// SLEEPER API HELPERS
// ============================================

export function parseSleeperRosterPositions(positions: string[]): {
  startingQB: number
  startingRB: number
  startingWR: number
  startingTE: number
  startingFlex: number
  startingIDP: number
  benchSlots: number
  superflex: boolean
} {
  const counts = {
    startingQB: 0,
    startingRB: 0,
    startingWR: 0,
    startingTE: 0,
    startingFlex: 0,
    startingIDP: 0,
    benchSlots: 0,
    superflex: false
  }

  for (const pos of positions) {
    const p = pos.toUpperCase()
    switch (p) {
      case 'QB':
        counts.startingQB++
        break
      case 'RB':
        counts.startingRB++
        break
      case 'WR':
        counts.startingWR++
        break
      case 'TE':
        counts.startingTE++
        break
      case 'FLEX':
      case 'REC_FLEX':
        counts.startingFlex++
        break
      case 'SUPER_FLEX':
        counts.superflex = true
        counts.startingFlex++
        break
      case 'BN':
        counts.benchSlots++
        break
      case 'DL':
      case 'LB':
      case 'DB':
      case 'IDP_FLEX':
        counts.startingIDP++
        break
    }
  }

  return counts
}

export function buildLeagueSettingsFromSleeper(
  leagueData: {
    league_id: string
    name: string
    total_rosters: number
    roster_positions: string[]
    scoring_settings: {
      rec?: number
      bonus_rec_te?: number
      pass_td?: number
      pass_int?: number
      rush_td?: number
      rec_td?: number
    }
    settings: {
      taxi_slots?: number
      num_teams?: number
    }
  },
  sport: 'nfl' | 'nba' = 'nfl'
): LeagueSettings {
  const rosterCounts = parseSleeperRosterPositions(leagueData.roster_positions)
  const scoring = leagueData.scoring_settings

  const scoringType = scoring.rec === 1 ? 'PPR' :
                      scoring.rec === 0.5 ? 'Half PPR' : 'Standard'

  const isTEP = (scoring.bonus_rec_te || 0) > 0
  const tepBonus = scoring.bonus_rec_te || 0

  const idpEnabled = rosterCounts.startingIDP > 0

  return {
    leagueId: leagueData.league_id,
    leagueName: leagueData.name,
    sport,
    numTeams: leagueData.total_rosters || leagueData.settings.num_teams || 12,
    scoringType,
    isSF: rosterCounts.superflex,
    isTEP,
    tepBonus,
    idpEnabled,
    idpStarterSlots: rosterCounts.startingIDP,
    rosterPositions: leagueData.roster_positions,
    starterSlots: leagueData.roster_positions.filter(p => p !== 'BN' && p !== 'IR').length,
    benchSlots: rosterCounts.benchSlots,
    taxiSlots: leagueData.settings.taxi_slots || 0,
    startingQB: rosterCounts.startingQB,
    startingRB: rosterCounts.startingRB,
    startingWR: rosterCounts.startingWR,
    startingTE: rosterCounts.startingTE,
    startingFlex: rosterCounts.startingFlex
  }
}

export function buildTeamRankings(
  rosters: SleeperRoster[]
): Record<number, number> {
  const sorted = [...rosters].sort((a, b) => {
    const winDiff = b.record.wins - a.record.wins
    if (winDiff !== 0) return winDiff
    return b.pointsFor - a.pointsFor
  })

  const rankings: Record<number, number> = {}
  sorted.forEach((r, idx) => {
    rankings[r.rosterId] = idx + 1
  })

  return rankings
}
