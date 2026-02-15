import type {
  EngineLeagueContext,
  EnginePlayerState,
  EngineAsset,
  EngineManagerProfile,
  EngineContext,
  InjuryStatus,
  DepthRole,
  TeamPhase,
  ArchetypeId,
} from './types'

export function normalizeLeagueContext(raw: {
  league_id?: string
  leagueId?: string
  name?: string
  leagueName?: string
  season?: string | number
  settings?: any
  scoring_settings?: any
  scoringSettings?: Record<string, number>
  roster_positions?: string[]
  rosterPositions?: string[]
  status?: string
  numTeams?: number
}): EngineLeagueContext {
  const settings = raw.settings || {}
  const scoringSettings = raw.scoring_settings || raw.scoringSettings || {}
  const rosterPositions = raw.roster_positions || raw.rosterPositions || []

  const ppr = scoringSettings.rec ?? 1
  const tepBonus = scoringSettings.bonus_rec_te ?? 0
  const passBonus = scoringSettings.pass_td ?? 4

  const sfSlots = rosterPositions.filter((p: string) => p === 'SUPER_FLEX').length
  const idpSlots = rosterPositions.filter((p: string) =>
    ['DL', 'LB', 'DB', 'IDP_FLEX', 'EDGE'].includes(p)
  ).length

  const starterSlots = rosterPositions.filter((p: string) => p !== 'BN' && p !== 'IR').length
  const benchSlots = rosterPositions.filter((p: string) => p === 'BN').length
  const irSlots = rosterPositions.filter((p: string) => p === 'IR').length

  const season = typeof raw.season === 'string' ? parseInt(raw.season) : (raw.season ?? new Date().getFullYear())

  return {
    leagueId: raw.league_id || raw.leagueId || '',
    leagueName: raw.name || raw.leagueName || 'Unknown League',
    sport: 'nfl',
    season,
    numTeams: raw.numTeams || settings.num_teams || 12,

    scoring: {
      format: ppr === 1 ? 'PPR' : ppr === 0.5 ? 'Half PPR' : 'Standard',
      ppr,
      tepBonus,
      isTEP: tepBonus > 0,
      isSF: sfSlots > 0,
      ppCarry: scoringSettings.pts_carry ?? 0,
      passBonus6pt: passBonus >= 6,
      scoringSettings,
    },

    roster: {
      positions: rosterPositions,
      starterSlots,
      benchSlots,
      taxiSlots: settings.taxi_slots ?? 0,
      irSlots,
      idpEnabled: idpSlots > 0,
      idpStarterSlots: idpSlots,
    },

    meta: {
      vetoRatePct: 0,
      tradeDeadlinePassed: false,
      isOffseason: raw.status === 'complete' || raw.status === 'pre_draft',
      weekNumber: 0,
    },
  }
}

export function normalizePlayerState(raw: {
  player_id?: string
  id?: string
  full_name?: string
  name?: string
  position?: string
  pos?: string
  team?: string | null
  age?: number | null
  years_exp?: number | null
  injury_status?: string | null
  value?: number
  slot?: string
}): EnginePlayerState {
  return {
    id: raw.player_id || raw.id || '',
    name: raw.full_name || raw.name || 'Unknown',
    position: raw.position || raw.pos || 'UNKNOWN',
    team: raw.team || null,
    age: raw.age ?? null,
    experience: raw.years_exp ?? null,

    injury: {
      status: normalizeInjuryStatus(raw.injury_status),
      bodyPart: null,
      severity: raw.injury_status && raw.injury_status !== 'Active' ? 3 : 0,
      gamesOut: 0,
    },

    usage: {
      snapPct: null,
      targetShare: null,
      rushShare: null,
      role: 'unknown',
    },

    value: {
      market: raw.value ?? 0,
      vorp: 0,
      replacement: 0,
    },

    isDevy: false,
    league: 'NFL',
    devyMeta: null,
  }
}

function normalizeInjuryStatus(raw: string | null | undefined): InjuryStatus {
  if (!raw) return 'healthy'
  const lower = raw.toLowerCase()
  if (lower === 'questionable' || lower === 'q') return 'questionable'
  if (lower === 'doubtful' || lower === 'd') return 'doubtful'
  if (lower === 'out' || lower === 'o') return 'out'
  if (lower === 'ir' || lower === 'injured_reserve') return 'ir'
  if (lower === 'pup') return 'pup'
  if (lower === 'active' || lower === 'a') return 'healthy'
  return 'unknown'
}

export function normalizeManagerProfile(
  roster: any,
  users: Record<string, any>,
  assets: EngineAsset[] = []
): EngineManagerProfile {
  const userId = roster.owner_id || ''
  const user = users[userId] || {}

  const wins = roster.settings?.wins ?? 0
  const losses = roster.settings?.losses ?? 0
  const ties = roster.settings?.ties ?? 0

  return {
    rosterId: roster.roster_id,
    userId,
    username: user.username || user.display_name || 'Unknown',
    displayName: user.display_name || user.username || 'Unknown',

    phase: 'unknown',
    archetype: 'unknown',

    record: { wins, losses, ties },
    pointsFor: roster.settings?.fpts ?? 0,
    standingsRank: 0,

    needs: [],
    surplus: [],

    behavior: {
      tradeAggression: 'medium',
      riskTolerance: 'medium',
      prefersYouth: false,
      prefersPicks: false,
      prefersConsolidation: false,
      avgTradesPerSeason: 0,
    },

    assets,
    faabRemaining: roster.settings?.waiver_budget_used != null
      ? 100 - (roster.settings.waiver_budget_used ?? 0)
      : 100,
  }
}

export function normalizeAssetFromPlayer(
  player: EnginePlayerState,
  slot: string = 'Bench'
): EngineAsset {
  return {
    id: player.id,
    type: 'player',
    value: player.value.market,
    displayName: player.name,
    player,
    pick: null,
    faab: null,
    tags: [],
  }
}

export function normalizeAssetFromPick(pick: {
  round: number
  year: number
  value?: number
  projected?: string
  originalOwner?: string
}): EngineAsset {
  return {
    id: `pick_${pick.year}_r${pick.round}`,
    type: 'pick',
    value: pick.value ?? 0,
    displayName: `${pick.year} Round ${pick.round}`,
    player: null,
    pick: {
      round: pick.round,
      year: pick.year,
      projected: (pick.projected as any) || 'unknown',
      originalOwner: pick.originalOwner || null,
      classStrength: null,
    },
    faab: null,
    tags: [],
  }
}

export function buildEngineContext(
  league: EngineLeagueContext,
  managers: Record<number, EngineManagerProfile>
): EngineContext {
  return {
    league,
    managers,
    timestamp: Date.now(),
  }
}
