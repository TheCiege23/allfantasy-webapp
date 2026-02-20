type SleeperPlayerEntry = {
  full_name?: string
  first_name?: string
  last_name?: string
  position?: string
  team?: string
  age?: number
}

type PlayerIdMap = Map<string, string>

let playersDict: Record<string, SleeperPlayerEntry> | null = null
let nameToIdMap: PlayerIdMap | null = null
let cacheTs = 0
const CACHE_TTL = 6 * 60 * 60 * 1000

function normalizeName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[.'\-]/g, '')
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function getSleeperPlayersDict(): Promise<Record<string, SleeperPlayerEntry>> {
  const now = Date.now()
  if (playersDict && now - cacheTs < CACHE_TTL) return playersDict
  try {
    const res = await fetch('https://api.sleeper.app/v1/players/nfl', {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return playersDict || {}
    const data = await res.json()
    playersDict = data
    cacheTs = now
    nameToIdMap = null
    return data
  } catch {
    return playersDict || {}
  }
}

function buildNameMap(dict: Record<string, SleeperPlayerEntry>): PlayerIdMap {
  if (nameToIdMap) return nameToIdMap
  const map: PlayerIdMap = new Map()
  for (const [id, p] of Object.entries(dict)) {
    if (!p || typeof p !== 'object') continue
    const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ')
    if (!name) continue
    const key = normalizeName(name)
    if (!map.has(key)) {
      map.set(key, id)
    }
  }
  nameToIdMap = map
  return map
}

export async function resolveSleeperIds(
  names: string[]
): Promise<Record<string, string>> {
  const dict = await getSleeperPlayersDict()
  const map = buildNameMap(dict)
  const result: Record<string, string> = {}
  for (const name of names) {
    const key = normalizeName(name)
    const id = map.get(key)
    if (id) result[name] = id
  }
  return result
}

export async function resolveSleeperIdsBatch(
  players: Array<{ name: string; team?: string | null; position?: string | null }>
): Promise<Map<string, string>> {
  const dict = await getSleeperPlayersDict()
  const map = buildNameMap(dict)
  const result = new Map<string, string>()
  for (const p of players) {
    const key = normalizeName(p.name)
    const id = map.get(key)
    if (id) {
      result.set(p.name, id)
    }
  }
  return result
}

export function sleeperAvatarUrl(avatarId?: string | null): string {
  if (!avatarId) return ''
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`
}
