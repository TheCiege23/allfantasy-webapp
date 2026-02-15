import { prisma } from '@/lib/prisma'

const SLEEPER_HEADSHOT_BASE = 'https://sleepercdn.com/content/nfl/players/thumb'
const ESPN_LOGO_BASE = 'https://a.espncdn.com/i/teamlogos/nfl/500'

const ESPN_TEAM_MAP: Record<string, string> = {
  ARI: 'ari', ATL: 'atl', BAL: 'bal', BUF: 'buf',
  CAR: 'car', CHI: 'chi', CIN: 'cin', CLE: 'cle',
  DAL: 'dal', DEN: 'den', DET: 'det', GB: 'gb',
  HOU: 'hou', IND: 'ind', JAX: 'jax', KC: 'kc',
  LAC: 'lac', LAR: 'lar', LV: 'lv', MIA: 'mia',
  MIN: 'min', NE: 'ne', NO: 'no', NYG: 'nyg',
  NYJ: 'nyj', PHI: 'phi', PIT: 'pit', SEA: 'sea',
  SF: 'sf', TB: 'tb', TEN: 'ten', WAS: 'was',
}

export interface PlayerMedia {
  headshotUrl: string | null
  teamLogoUrl: string | null
}

export interface StandardPlayer {
  playerId: string
  fullName: string
  position: string
  teamAbbr: string | null
  sport: string
  media: PlayerMedia
}

export interface ResolvedPlayerMedia {
  playerId: string
  sport: string
  teamAbbr: string | null
  media: PlayerMedia
  source: 'db' | 'template'
}

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const PLAYER_CACHE = new Map<string, CacheEntry<ResolvedPlayerMedia>>()
const TEAM_CACHE = new Map<string, CacheEntry<PlayerMedia>>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function cacheKey(playerId: string, sport: string): string {
  return `${sport}:${playerId}`
}

function teamCacheKey(teamAbbr: string, sport: string): string {
  return `${sport}:team:${teamAbbr}`
}

function getTeamLogoUrl(teamAbbr: string | null): string | null {
  if (!teamAbbr) return null
  const upper = teamAbbr.toUpperCase()
  const key = ESPN_TEAM_MAP[upper]
  return key ? `${ESPN_LOGO_BASE}/${key}.png` : null
}

function buildHeadshotUrl(playerId: string | null): string | null {
  return playerId ? `${SLEEPER_HEADSHOT_BASE}/${playerId}.jpg` : null
}

function buildMediaFromTemplate(playerId: string | null, teamAbbr: string | null): PlayerMedia {
  return {
    headshotUrl: buildHeadshotUrl(playerId),
    teamLogoUrl: getTeamLogoUrl(teamAbbr),
  }
}

export function buildPlayerMedia(playerId: string | null, teamAbbr: string | null): PlayerMedia {
  return buildMediaFromTemplate(playerId, teamAbbr)
}

export function attachTeamMedia(teamAbbr: string | null, sport: string = 'nfl'): PlayerMedia {
  if (!teamAbbr) return { headshotUrl: null, teamLogoUrl: null }

  const ck = teamCacheKey(teamAbbr, sport)
  const cached = TEAM_CACHE.get(ck)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const media: PlayerMedia = {
    headshotUrl: null,
    teamLogoUrl: getTeamLogoUrl(teamAbbr),
  }

  TEAM_CACHE.set(ck, { data: media, expiresAt: Date.now() + CACHE_TTL_MS })
  return media
}

export async function attachPlayerMedia(player: {
  playerId: string
  teamAbbr?: string | null
  sport?: string
}): Promise<ResolvedPlayerMedia> {
  const sport = player.sport || 'nfl'
  const ck = cacheKey(player.playerId, sport)

  const cached = PLAYER_CACHE.get(ck)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  let dbTeamAbbr: string | null = null
  let dbImageUrl: string | null = null
  let source: 'db' | 'template' = 'template'

  try {
    const identity = await prisma.playerIdentityMap.findFirst({
      where: { sleeperId: player.playerId },
      select: { currentTeam: true },
    })

    if (identity?.currentTeam) {
      dbTeamAbbr = identity.currentTeam
      source = 'db'
    }

    if (!dbImageUrl) {
      const sportsPlayer = await prisma.sportsPlayer.findFirst({
        where: { sleeperId: player.playerId, sport: sport.toUpperCase() },
        select: { imageUrl: true, team: true },
        orderBy: { fetchedAt: 'desc' },
      })
      if (sportsPlayer?.imageUrl) {
        dbImageUrl = sportsPlayer.imageUrl
        source = 'db'
      }
      if (sportsPlayer?.team && !dbTeamAbbr) {
        dbTeamAbbr = sportsPlayer.team
        source = 'db'
      }
    }
  } catch {
    /* DB unavailable — fall through to template */
  }

  const effectiveTeam = dbTeamAbbr || player.teamAbbr || null

  const media: PlayerMedia = {
    headshotUrl: dbImageUrl || buildHeadshotUrl(player.playerId),
    teamLogoUrl: getTeamLogoUrl(effectiveTeam),
  }

  const result: ResolvedPlayerMedia = {
    playerId: player.playerId,
    sport,
    teamAbbr: effectiveTeam,
    media,
    source,
  }

  PLAYER_CACHE.set(ck, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}

export async function attachPlayerMediaBatch(
  players: Array<{
    playerId: string
    teamAbbr?: string | null
    sport?: string
  }>
): Promise<Map<string, ResolvedPlayerMedia>> {
  const results = new Map<string, ResolvedPlayerMedia>()
  const toResolve: Array<{ playerId: string; teamAbbr: string | null; sport: string }> = []

  for (const p of players) {
    const sport = p.sport || 'nfl'
    const ck = cacheKey(p.playerId, sport)
    const cached = PLAYER_CACHE.get(ck)
    if (cached && cached.expiresAt > Date.now()) {
      results.set(p.playerId, cached.data)
    } else {
      toResolve.push({ playerId: p.playerId, teamAbbr: p.teamAbbr || null, sport })
    }
  }

  if (toResolve.length === 0) return results

  const sleeperIds = toResolve.map(p => p.playerId)

  let identityMap = new Map<string, { currentTeam: string | null }>()
  let sportsPlayerMap = new Map<string, { imageUrl: string | null; team: string | null }>()

  try {
    const identities = await prisma.playerIdentityMap.findMany({
      where: { sleeperId: { in: sleeperIds } },
      select: { sleeperId: true, currentTeam: true },
    })
    for (const id of identities) {
      if (id.sleeperId) identityMap.set(id.sleeperId, { currentTeam: id.currentTeam })
    }

    const sportsPlayers = await prisma.sportsPlayer.findMany({
      where: { sleeperId: { in: sleeperIds } },
      select: { sleeperId: true, imageUrl: true, team: true },
      orderBy: { fetchedAt: 'desc' },
    })
    for (const sp of sportsPlayers) {
      if (sp.sleeperId && !sportsPlayerMap.has(sp.sleeperId)) {
        sportsPlayerMap.set(sp.sleeperId, { imageUrl: sp.imageUrl, team: sp.team })
      }
    }
  } catch {
    /* DB unavailable — fall through to templates */
  }

  for (const p of toResolve) {
    const identity = identityMap.get(p.playerId)
    const sportsPlayer = sportsPlayerMap.get(p.playerId)

    const dbTeamAbbr = identity?.currentTeam || sportsPlayer?.team || null
    const effectiveTeam = dbTeamAbbr || p.teamAbbr
    const dbImageUrl = sportsPlayer?.imageUrl || null
    const source: 'db' | 'template' = (dbTeamAbbr || dbImageUrl) ? 'db' : 'template'

    const media: PlayerMedia = {
      headshotUrl: dbImageUrl || buildHeadshotUrl(p.playerId),
      teamLogoUrl: getTeamLogoUrl(effectiveTeam),
    }

    const result: ResolvedPlayerMedia = {
      playerId: p.playerId,
      sport: p.sport,
      teamAbbr: effectiveTeam,
      media,
      source,
    }

    PLAYER_CACHE.set(cacheKey(p.playerId, p.sport), { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
    results.set(p.playerId, result)
  }

  return results
}

export async function getHistoricalTeam(
  playerId: string,
  season: number,
  week?: number | null,
  sport: string = 'nfl'
): Promise<string | null> {
  try {
    const effectiveWeek = week ?? 0

    if (effectiveWeek > 0) {
      const exact = await prisma.playerTeamHistory.findUnique({
        where: {
          playerId_sport_season_week: { playerId, sport, season, week: effectiveWeek },
        },
        select: { teamAbbr: true },
      })
      if (exact) return exact.teamAbbr
    }

    const seasonEntry = await prisma.playerTeamHistory.findUnique({
      where: {
        playerId_sport_season_week: { playerId, sport, season, week: 0 },
      },
      select: { teamAbbr: true },
    })
    if (seasonEntry) return seasonEntry.teamAbbr

    return null
  } catch {
    return null
  }
}

export async function attachPlayerMediaHistorical(
  player: { playerId: string; teamAbbr?: string | null; sport?: string },
  season: number,
  week?: number | null
): Promise<ResolvedPlayerMedia> {
  const sport = player.sport || 'nfl'
  const historicalTeam = await getHistoricalTeam(player.playerId, season, week, sport)
  const effectiveTeam = historicalTeam || player.teamAbbr || null

  const media: PlayerMedia = {
    headshotUrl: buildHeadshotUrl(player.playerId),
    teamLogoUrl: getTeamLogoUrl(effectiveTeam),
  }

  return {
    playerId: player.playerId,
    sport,
    teamAbbr: effectiveTeam,
    media,
    source: historicalTeam ? 'db' : 'template',
  }
}

export async function recordTeamHistory(
  playerId: string,
  teamAbbr: string,
  season: number,
  week?: number | null,
  sport: string = 'nfl',
  source: string = 'sleeper'
): Promise<void> {
  try {
    await prisma.playerTeamHistory.upsert({
      where: {
        playerId_sport_season_week: {
          playerId,
          sport,
          season,
          week: week ?? 0,
        },
      },
      update: { teamAbbr, source },
      create: { playerId, sport, season, week: week ?? 0, teamAbbr, source },
    })
  } catch {
    /* non-critical — best effort */
  }
}

export function toStandardPlayer(
  playerId: string,
  fullName: string,
  position: string,
  teamAbbr: string | null,
): StandardPlayer {
  return {
    playerId,
    fullName,
    position,
    teamAbbr,
    sport: 'nfl',
    media: buildMediaFromTemplate(playerId, teamAbbr),
  }
}

export function clearMediaCache(): void {
  PLAYER_CACHE.clear()
  TEAM_CACHE.clear()
}
