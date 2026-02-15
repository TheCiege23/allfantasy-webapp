import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { normalizeTeamAbbrev, normalizePosition } from '@/lib/team-abbrev'

export const dynamic = 'force-dynamic'

type Sport = 'nfl' | 'nba'
type RosterSlot = 'Starter' | 'Bench' | 'IR' | 'Taxi'

type RosteredPlayer = {
  id: string
  name: string
  pos: string
  team?: string
  slot: RosterSlot
  isIdp?: boolean
}

type SleeperUser = {
  user_id: string
  display_name?: string
  username?: string
}

type SleeperRoster = {
  roster_id: number
  owner_id: string | null
  co_owners?: string[] | null
  players?: string[] | null
  starters?: string[] | null
  reserve?: string[] | null
  taxi?: string[] | null
}

type SleeperPlayer = {
  full_name?: string
  first_name?: string
  last_name?: string
  position?: string
  team?: string
}

const playersCache: Record<
  Sport,
  { at: number; data: Record<string, SleeperPlayer> | null }
> = {
  nfl: { at: 0, data: null },
  nba: { at: 0, data: null },
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function fetchJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 0 } })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function getSleeperPlayers(sport: Sport) {
  const now = Date.now()
  const cached = playersCache[sport]
  if (cached.data && now - cached.at < CACHE_TTL_MS) return cached.data

  const url = `https://api.sleeper.app/v1/players/${sport}`
  const r = await fetchJson(url)
  if (!r.ok || !r.json) {
    throw new Error(`Failed to fetch Sleeper players (${sport}). status=${r.status}`)
  }

  playersCache[sport] = { at: now, data: r.json as Record<string, SleeperPlayer> }
  return playersCache[sport].data!
}

function normalizeName(s?: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function isIdpPos(pos?: string) {
  const p = (pos || '').toUpperCase()
  return p === 'DL' || p === 'LB' || p === 'DB' || p === 'EDGE' || p === 'IDP'
}

export const GET = withApiUsage({ endpoint: "/api/legacy/trade/roster", tool: "LegacyTradeRoster" })(async (req: NextRequest) => {
  try {
    const leagueId = String(req.nextUrl.searchParams.get('league_id') || '').trim()
    const sleeperUsername = String(req.nextUrl.searchParams.get('sleeper_username') || '').trim()
    const sportRaw = String(req.nextUrl.searchParams.get('sport') || 'nfl').trim().toLowerCase()

    if (!leagueId) return NextResponse.json({ error: 'Missing league_id' }, { status: 400 })
    if (!sleeperUsername) return NextResponse.json({ error: 'Missing sleeper_username' }, { status: 400 })

    const sport: Sport = sportRaw === 'nba' ? 'nba' : 'nfl'

    // 1) Find user_id from league users
    const usersUrl = `https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/users`
    const usersRes = await fetchJson(usersUrl)
    if (!usersRes.ok || !Array.isArray(usersRes.json)) {
      return NextResponse.json(
        { error: 'Failed to load league users from Sleeper' },
        { status: 502 }
      )
    }

    const target = normalizeName(sleeperUsername)
    const users = usersRes.json as SleeperUser[]
    const user =
      users.find((u) => normalizeName(u.username) === target) ||
      users.find((u) => normalizeName(u.display_name) === target)
    if (!user?.user_id) {
      return NextResponse.json(
        { error: `User not found in league: ${sleeperUsername}` },
        { status: 404 }
      )
    }

    // 2) Get rosters, find roster for user_id
    const rostersUrl = `https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/rosters`
    const rostersRes = await fetchJson(rostersUrl)
    if (!rostersRes.ok || !Array.isArray(rostersRes.json)) {
      return NextResponse.json(
        { error: 'Failed to load league rosters from Sleeper' },
        { status: 502 }
      )
    }

    const rosters = rostersRes.json as SleeperRoster[]
    const uid = String(user.user_id)
    const roster =
      rosters.find((r) => String(r.owner_id || '') === uid) ||
      rosters.find((r) => Array.isArray(r.co_owners) && r.co_owners.map(String).includes(uid))
    if (!roster) {
      return NextResponse.json(
        { error: `Roster not found for user in league: ${sleeperUsername}` },
        { status: 404 }
      )
    }

    const players = (roster.players || []).filter(Boolean)
    const starters = new Set((roster.starters || []).filter(Boolean))
    const reserve = new Set((roster.reserve || []).filter(Boolean))
    const taxi = new Set((roster.taxi || []).filter(Boolean))

    // 3) Load player directory (cached)
    const dict = await getSleeperPlayers(sport)

    // 4) Shape rostered players
    const out: RosteredPlayer[] = players.map((pid) => {
      const meta = dict[pid] || {}
      const name =
        meta.full_name ||
        [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
        pid

      const pos = normalizePosition(meta.position) || (meta.position || '').toUpperCase()
      const team = normalizeTeamAbbrev(meta.team) || undefined

      let slot: RosterSlot = 'Bench'
      if (starters.has(pid)) slot = 'Starter'
      else if (reserve.has(pid)) slot = 'IR'
      else if (taxi.has(pid)) slot = 'Taxi'

      return {
        id: pid,
        name,
        pos: pos || 'UNK',
        team,
        slot,
        isIdp: sport === 'nfl' ? isIdpPos(pos) : false,
      }
    })

    // Stable sort: starters first, then bench, then IR, then taxi
    const slotOrder: Record<RosterSlot, number> = { Starter: 1, Bench: 2, IR: 3, Taxi: 4 }
    out.sort((a, b) => {
      const s = slotOrder[a.slot] - slotOrder[b.slot]
      if (s !== 0) return s
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      success: true,
      resolved: {
        league_id: leagueId,
        sport,
        sleeper_username_input: sleeperUsername,
        username: user.username || '',
        display_name: user.display_name || '',
        user_id: user.user_id,
        roster_id: roster.roster_id,
      },
      roster: out,
    })
  } catch (e) {
    console.error('trade/roster error', e)
    return NextResponse.json({ error: 'Failed to load roster', details: String(e) }, { status: 500 })
  }
})
