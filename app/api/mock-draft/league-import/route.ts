import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSleeperPlayersDict, sleeperAvatarUrl } from '@/lib/sleeper/players-cache'

async function fetchSleeper(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { league_id } = body

    if (!league_id || typeof league_id !== 'string') {
      return NextResponse.json({ error: 'league_id is required' }, { status: 400 })
    }

    const [leagueData, rostersData, usersData, tradedPicksData] = await Promise.all([
      fetchSleeper(`https://api.sleeper.app/v1/league/${league_id}`),
      fetchSleeper(`https://api.sleeper.app/v1/league/${league_id}/rosters`),
      fetchSleeper(`https://api.sleeper.app/v1/league/${league_id}/users`),
      fetchSleeper(`https://api.sleeper.app/v1/league/${league_id}/traded_picks`),
    ])

    const allPlayerIds = new Set<string>()
    for (const roster of rostersData) {
      if (Array.isArray(roster.players)) {
        for (const pid of roster.players) allPlayerIds.add(String(pid))
      }
    }

    const playersDict = await getSleeperPlayersDict()

    const userMap = new Map<string, any>()
    for (const u of usersData) {
      userMap.set(u.user_id, u)
    }

    const rosterOwnerMap = new Map<number, { userId: string; displayName: string; avatar: string }>()
    for (const roster of rostersData) {
      const owner = userMap.get(roster.owner_id)
      rosterOwnerMap.set(roster.roster_id, {
        userId: roster.owner_id || '',
        displayName: owner?.display_name || `Owner ${roster.roster_id}`,
        avatar: owner?.avatar ? sleeperAvatarUrl(owner.avatar) : '',
      })
    }

    let draftOrder: number[] = []
    try {
      const draftsData = await fetchSleeper(`https://api.sleeper.app/v1/league/${league_id}/drafts`)
      if (Array.isArray(draftsData) && draftsData.length > 0) {
        const latestDraft = draftsData[0]
        if (latestDraft.draft_order && typeof latestDraft.draft_order === 'object') {
          const orderEntries = Object.entries(latestDraft.draft_order as Record<string, number>)
          const userToSlot = new Map<string, number>()
          for (const [userId, slot] of orderEntries) {
            userToSlot.set(userId, slot as number)
          }
          const rosterSlots: { rosterId: number; slot: number }[] = []
          for (const roster of rostersData) {
            const slot = userToSlot.get(roster.owner_id)
            if (slot !== undefined) {
              rosterSlots.push({ rosterId: roster.roster_id, slot })
            }
          }
          rosterSlots.sort((a, b) => a.slot - b.slot)
          draftOrder = rosterSlots.map(r => r.rosterId)
        }
      }
    } catch {}

    if (draftOrder.length === 0) {
      draftOrder = rostersData
        .map((r: any) => r.roster_id as number)
        .sort((a: number, b: number) => a - b)
    }

    const draftSlotMap = new Map<number, number>()
    draftOrder.forEach((rosterId, idx) => {
      draftSlotMap.set(rosterId, idx + 1)
    })

    const managers = rostersData.map((roster: any) => {
      const info = rosterOwnerMap.get(roster.roster_id)
      return {
        userId: info?.userId || '',
        displayName: info?.displayName || `Owner ${roster.roster_id}`,
        avatar: info?.avatar || '',
        rosterId: roster.roster_id,
        draftSlot: draftSlotMap.get(roster.roster_id) || roster.roster_id,
      }
    })

    managers.sort((a: any, b: any) => a.draftSlot - b.draftSlot)

    const rosters: Record<string, Array<{ playerId: string; name: string; position: string; team: string }>> = {}
    for (const roster of rostersData) {
      const key = String(roster.roster_id)
      const playerList: Array<{ playerId: string; name: string; position: string; team: string }> = []
      if (Array.isArray(roster.players)) {
        for (const pid of roster.players) {
          const id = String(pid)
          const p = playersDict[id]
          playerList.push({
            playerId: id,
            name: p?.full_name || p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : `Player ${id}`,
            position: p?.position || 'UNK',
            team: p?.team || 'FA',
          })
        }
      }
      rosters[key] = playerList
    }

    const tradedPicks = Array.isArray(tradedPicksData) ? tradedPicksData.map((pick: any) => {
      const prevOwnerInfo = rosterOwnerMap.get(pick.previous_owner_id)
      const newOwnerInfo = rosterOwnerMap.get(pick.owner_id)
      return {
        season: pick.season,
        round: pick.round,
        rosterId: pick.roster_id,
        previousOwner: prevOwnerInfo?.displayName || `Roster ${pick.previous_owner_id}`,
        newOwner: newOwnerInfo?.displayName || `Roster ${pick.owner_id}`,
        originalRosterId: pick.roster_id,
        previousOwnerId: pick.previous_owner_id,
        newOwnerId: pick.owner_id,
      }
    }) : []

    const rosterPositions: string[] = leagueData.roster_positions || []
    const scoringSettings = leagueData.scoring_settings || {}
    const isDynasty = leagueData.settings?.type === 2
    const isSF = rosterPositions.includes('SUPER_FLEX')
    const isPPR = scoringSettings.rec === 1

    const leagueSettings = {
      name: leagueData.name || '',
      totalTeams: leagueData.total_rosters || rostersData.length,
      rosterPositions,
      scoringSettings,
      leagueType: isDynasty ? 'dynasty' : 'redraft',
      season: parseInt(leagueData.season) || new Date().getFullYear(),
      isSF,
      isPPR,
    }

    return NextResponse.json({
      leagueSettings,
      managers,
      rosters,
      tradedPicks,
      draftOrder,
    })
  } catch (err: any) {
    console.error('[mock-draft/league-import] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to import league data' }, { status: 500 })
  }
}
