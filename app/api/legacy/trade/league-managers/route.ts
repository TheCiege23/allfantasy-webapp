import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Sport = 'nfl' | 'nba'

interface SleeperUser {
  user_id: string
  display_name?: string
  username?: string
}

interface SleeperRoster {
  roster_id: number
  owner_id: string | null
  players?: string[] | null
  starters?: string[] | null
  reserve?: string[] | null
  taxi?: string[] | null
  settings?: {
    wins?: number
    losses?: number
    fpts?: number
    waiver_budget_used?: number
  }
}

interface SleeperLeague {
  season?: string
  season_type?: string
  status?: string
  total_rosters?: number
  settings?: {
    waiver_budget?: number
    trade_deadline?: number
    num_teams?: number
    playoff_teams?: number
    playoff_week_start?: number
    best_ball?: number
    taxi_slots?: number
    reserve_slots?: number
    bench_lock?: number
    disable_trades?: number
    veto_votes_needed?: number
  }
  scoring_settings?: Record<string, number>
  roster_positions?: string[]
}

interface SleeperDraftPick {
  season: string
  round: number
  roster_id: number
  previous_owner_id: number
  owner_id: number
}

interface SleeperDraft {
  draft_id: string
  season: string
  status: string
  draft_order?: Record<string, number> // user_id -> pick position (1-12)
  slot_to_roster_id?: Record<string, number> // slot position -> roster_id
}

interface SleeperDraftPickDetails {
  round: number
  pick_no: number // pick within round (1-12)
  roster_id: number
  draft_slot: number
}

interface SleeperPlayer {
  full_name?: string
  first_name?: string
  last_name?: string
  position?: string
  team?: string
}

const playersCache: Record<Sport, { at: number; data: Record<string, SleeperPlayer> | null }> = {
  nfl: { at: 0, data: null },
  nba: { at: 0, data: null },
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000

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

export const GET = withApiUsage({ endpoint: "/api/legacy/trade/league-managers", tool: "LegacyTradeLeagueManagers" })(async (req: NextRequest) => {
  try {
    const leagueId = String(req.nextUrl.searchParams.get('league_id') || '').trim()
    const sportRaw = String(req.nextUrl.searchParams.get('sport') || 'nfl').trim().toLowerCase()

    if (!leagueId) {
      return NextResponse.json({ error: 'Missing league_id' }, { status: 400 })
    }

    const sport: Sport = sportRaw === 'nba' ? 'nba' : 'nfl'

    // 1) Get league info for FAAB budget
    const leagueUrl = `https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}`
    const leagueRes = await fetchJson(leagueUrl)
    const leagueData = leagueRes.json as SleeperLeague | null
    const totalFaabBudget = leagueData?.settings?.waiver_budget || 100
    const rosterPositions = leagueData?.roster_positions || []

    // 2) Get all users in the league
    const usersUrl = `https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/users`
    const usersRes = await fetchJson(usersUrl)
    if (!usersRes.ok || !Array.isArray(usersRes.json)) {
      return NextResponse.json({ error: 'Failed to load league users from Sleeper' }, { status: 502 })
    }
    const users = usersRes.json as SleeperUser[]

    // 3) Get all rosters
    const rostersUrl = `https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/rosters`
    const rostersRes = await fetchJson(rostersUrl)
    if (!rostersRes.ok || !Array.isArray(rostersRes.json)) {
      return NextResponse.json({ error: 'Failed to load league rosters from Sleeper' }, { status: 502 })
    }
    const rosters = rostersRes.json as SleeperRoster[]

    // 4) Get traded draft picks
    const picksUrl = `https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/traded_picks`
    const picksRes = await fetchJson(picksUrl)
    const tradedPicks = (picksRes.ok && Array.isArray(picksRes.json)) 
      ? (picksRes.json as SleeperDraftPick[]) 
      : []

    // 4b) Get drafts to determine pick slots
    const draftsUrl = `https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/drafts`
    const draftsRes = await fetchJson(draftsUrl)
    const drafts = (draftsRes.ok && Array.isArray(draftsRes.json)) 
      ? (draftsRes.json as SleeperDraft[])
      : []
    
    // Build user_id to roster_id map for draft order conversion
    const userToRoster = new Map<string, number>()
    rosters.forEach((r: SleeperRoster) => {
      if (r.owner_id) {
        userToRoster.set(r.owner_id, r.roster_id)
      }
    })
    
    // Build a map of roster_id -> draft slot for each season
    const rosterToSlot: Record<string, Map<number, number>> = {}
    for (const draft of drafts) {
      const slotMap = new Map<number, number>()
      
      // Check slot_to_roster_id first (maps slot -> roster_id)
      if (draft.slot_to_roster_id) {
        for (const [slotStr, rId] of Object.entries(draft.slot_to_roster_id)) {
          const slot = parseInt(slotStr)
          slotMap.set(rId, slot)
        }
      }
      // Also check draft_order (maps user_id -> slot) - more common in Sleeper
      else if (draft.draft_order) {
        for (const [userId, slot] of Object.entries(draft.draft_order)) {
          const rosterId = userToRoster.get(userId)
          if (rosterId) {
            slotMap.set(rosterId, slot as number)
          }
        }
      }
      
      if (slotMap.size > 0) {
        rosterToSlot[draft.season] = slotMap
      }
    }

    // 5) Load player directory
    const playersDict = await getSleeperPlayers(sport)

    // Create a map of user_id to display name
    const userMap = new Map<string, string>()
    users.forEach(u => {
      const name = u.display_name || u.username || u.user_id
      userMap.set(u.user_id, name)
    })

    // Create a map of roster_id to owner info
    const rosterOwnerMap = new Map<number, { userId: string; displayName: string }>()
    rosters.forEach(r => {
      if (r.owner_id) {
        rosterOwnerMap.set(r.roster_id, {
          userId: r.owner_id,
          displayName: userMap.get(r.owner_id) || `Team ${r.roster_id}`
        })
      }
    })

    // Determine current year for draft picks
    const currentYear = new Date().getFullYear()
    const futureYears = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3]

    // Build managers data
    const managers = rosters.map(roster => {
      const ownerInfo = rosterOwnerMap.get(roster.roster_id)
      const displayName = ownerInfo?.displayName || `Team ${roster.roster_id}`
      const userId = ownerInfo?.userId || ''

      const starterIds = (roster.starters || []).filter(Boolean)

      const playerIds = roster.players || []
      const players = playerIds.map(pid => {
        const meta = playersDict[pid] || {}
        const name = meta.full_name || 
          [meta.first_name, meta.last_name].filter(Boolean).join(' ') || 
          pid
        const pos = (meta.position || 'UNK').toUpperCase()
        const team = (meta.team || '').toUpperCase() || undefined
        return { id: pid, name, pos, team }
      })

      // Sort players by position value (QB > RB > WR > TE > others)
      const posOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 }
      players.sort((a, b) => {
        const aOrder = posOrder[a.pos] || 99
        const bOrder = posOrder[b.pos] || 99
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.name.localeCompare(b.name)
      })

      // Calculate draft picks owned by this roster
      const draftPicks: { season: string; round: number; slot: number | null; originalOwner: string; originalRosterId: number }[] = []
      const numTeams = rosters.length
      
      // Start with default picks for future years
      futureYears.forEach(year => {
        const yearStr = String(year)
        const numRounds = sport === 'nfl' ? 4 : 3
        
        // Get draft slot for this roster's original picks
        const slotMap = rosterToSlot[yearStr]
        const rosterSlot = slotMap?.get(roster.roster_id) || null
        
        for (let round = 1; round <= numRounds; round++) {
          // Check if this pick was traded away
          const tradedAway = tradedPicks.find(p => 
            p.season === yearStr && 
            p.round === round && 
            p.previous_owner_id === roster.roster_id &&
            p.owner_id !== roster.roster_id
          )
          
          if (!tradedAway) {
            draftPicks.push({
              season: yearStr,
              round,
              slot: rosterSlot,
              originalOwner: displayName,
              originalRosterId: roster.roster_id
            })
          }
        }
      })

      // Add picks traded TO this roster
      tradedPicks
        .filter(p => p.owner_id === roster.roster_id && p.previous_owner_id !== roster.roster_id)
        .forEach(p => {
          const originalOwnerName = rosterOwnerMap.get(p.previous_owner_id)?.displayName || `Team ${p.previous_owner_id}`
          const slotMap = rosterToSlot[p.season]
          const originalSlot = slotMap?.get(p.previous_owner_id) || null
          
          draftPicks.push({
            season: p.season,
            round: p.round,
            slot: originalSlot,
            originalOwner: originalOwnerName,
            originalRosterId: p.previous_owner_id
          })
        })

      // Sort picks by year then round then slot
      draftPicks.sort((a, b) => {
        const yearDiff = parseInt(a.season) - parseInt(b.season)
        if (yearDiff !== 0) return yearDiff
        if (a.round !== b.round) return a.round - b.round
        return (a.slot || 99) - (b.slot || 99)
      })

      // Calculate remaining FAAB
      const faabUsed = roster.settings?.waiver_budget_used || 0
      const faabRemaining = totalFaabBudget - faabUsed

      // Calculate record and rank
      const wins = roster.settings?.wins || 0
      const losses = roster.settings?.losses || 0
      const pointsFor = roster.settings?.fpts || 0

      return {
        rosterId: roster.roster_id,
        userId,
        displayName,
        players,
        starters: starterIds,
        draftPicks,
        faab: {
          total: totalFaabBudget,
          used: faabUsed,
          remaining: faabRemaining
        },
        record: { wins, losses },
        pointsFor
      }
    })

    // Sort managers by wins (best first)
    managers.sort((a, b) => {
      const winDiff = b.record.wins - a.record.wins
      if (winDiff !== 0) return winDiff
      return b.pointsFor - a.pointsFor
    })

    const scoringSettings = leagueData?.scoring_settings || {}
    const ppr = scoringSettings.rec ?? 0
    const tepBonus = scoringSettings.bonus_rec_te ?? 0
    const ppCarry = scoringSettings.rush_att ?? 0
    const ppCompletion = scoringSettings.pass_cmp ?? 0
    const sixPtPassTd = (scoringSettings.pass_td ?? 4) >= 6
    const isSuperFlex = rosterPositions.includes('SUPER_FLEX')
    const isTEP = tepBonus > 0
    const idp = rosterPositions.some(p => ['DL', 'LB', 'DB', 'IDP_FLEX'].includes(p))

    const slotCounts: Record<string, number> = {}
    rosterPositions.forEach(p => { slotCounts[p] = (slotCounts[p] || 0) + 1 })

    const tradeDeadlineWeek = leagueData?.settings?.trade_deadline ?? 99
    const vetoVotesNeeded = leagueData?.settings?.veto_votes_needed ?? 0

    return NextResponse.json({ 
      success: true, 
      managers,
      leagueSettings: {
        faabBudget: totalFaabBudget,
        sport,
        rosterPositions,
        season: leagueData?.season || String(new Date().getFullYear()),
        seasonType: leagueData?.season_type || 'regular',
        status: leagueData?.status || 'unknown',
        numTeams: rosters.length,

        scoring: {
          ppr,
          tepBonus,
          ppCarry,
          ppCompletion,
          sixPtPassTd,
          passTd: scoringSettings.pass_td ?? 4,
          passInt: scoringSettings.pass_int ?? -2,
          rushTd: scoringSettings.rush_td ?? 6,
          recTd: scoringSettings.rec_td ?? 6,
          fumLost: scoringSettings.fum_lost ?? -2,
          raw: scoringSettings,
        },

        roster: {
          slots: slotCounts,
          maxRoster: rosterPositions.length,
          taxiSlots: leagueData?.settings?.taxi_slots ?? 0,
          reserveSlots: leagueData?.settings?.reserve_slots ?? 0,
        },

        flags: {
          isSuperFlex,
          isTEP,
          idp,
          bestBall: !!(leagueData?.settings?.best_ball),
        },

        trade: {
          tradeDeadlineWeek,
          vetoType: vetoVotesNeeded > 0 ? 'vote' : 'none',
          faabTradable: totalFaabBudget > 0,
        },
      }
    })
  } catch (e) {
    console.error('trade/league-managers error', e)
    return NextResponse.json({ error: 'Failed to load league managers', details: String(e) }, { status: 500 })
  }
})
