import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { getAllPlayers } from '@/lib/sleeper-client'

const openai = new OpenAI()

interface SleeperLeague {
  league_id: string
  name: string
  sport: string
  season: string
  season_type: string
  total_rosters: number
  status: string
  settings: {
    type?: number
    playoff_teams?: number
    num_teams?: number
  }
  scoring_settings?: Record<string, number>
  roster_positions?: string[]
  avatar?: string
  previous_league_id?: string
}

interface SleeperUser {
  user_id: string
  username: string
  display_name: string
  avatar?: string
}

interface SleeperRoster {
  roster_id: number
  owner_id: string
  players?: string[]
  starters?: string[]
  reserve?: string[]
  taxi?: string[]
  settings?: {
    wins?: number
    losses?: number
    ties?: number
    fpts?: number
    fpts_decimal?: number
  }
}

interface SleeperMatchup {
  roster_id: number
  matchup_id: number
  points: number
}

interface SleeperTransaction {
  transaction_id: string
  type: string
  status: string
  created: number
  adds?: Record<string, string>
  drops?: Record<string, string>
  draft_picks?: any[]
  roster_ids?: number[]
}

interface SleeperDraftPick {
  round: number
  roster_id: number
  player_id: string
  picked_by: string
  pick_no: number
  metadata?: {
    first_name?: string
    last_name?: string
    position?: string
    team?: string
  }
}

async function fetchSleeperData(url: string) {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

export const POST = withApiUsage({ endpoint: "/api/legacy/transfer", tool: "LegacyTransfer" })(async (req: NextRequest) => {
  try {
    const { leagueId } = await req.json()
    
    if (!leagueId || typeof leagueId !== 'string') {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 })
    }

    const cleanId = leagueId.trim()
    
    const league: SleeperLeague = await fetchSleeperData(`https://api.sleeper.app/v1/league/${cleanId}`)
    if (!league) {
      return NextResponse.json({ error: 'League not found. Please check your League ID.' }, { status: 404 })
    }

    const [users, rosters, drafts] = await Promise.all([
      fetchSleeperData(`https://api.sleeper.app/v1/league/${cleanId}/users`) as Promise<SleeperUser[]>,
      fetchSleeperData(`https://api.sleeper.app/v1/league/${cleanId}/rosters`) as Promise<SleeperRoster[]>,
      fetchSleeperData(`https://api.sleeper.app/v1/league/${cleanId}/drafts`),
    ])

    const rosterToUser: Record<number, SleeperUser> = {}
    if (rosters && users) {
      rosters.forEach(roster => {
        const user = users.find(u => u.user_id === roster.owner_id)
        if (user) rosterToUser[roster.roster_id] = user
      })
    }

    let transactions: SleeperTransaction[] = []
    try {
      const currentWeek = 18
      for (let week = 1; week <= currentWeek; week++) {
        const weekTx = await fetchSleeperData(`https://api.sleeper.app/v1/league/${cleanId}/transactions/${week}`)
        if (weekTx) transactions = transactions.concat(weekTx)
      }
    } catch {}

    const trades = transactions.filter(t => t.type === 'trade' && t.status === 'complete')

    let draftPicks: SleeperDraftPick[] = []
    let draftSlotMap: Record<number, number> = {}
    let draftInfo: { type?: string; status?: string; startTime?: number } = {}
    if (drafts && drafts.length > 0) {
      const latestDraft = drafts[0]
      draftPicks = await fetchSleeperData(`https://api.sleeper.app/v1/draft/${latestDraft.draft_id}/picks`) || []
      draftInfo = {
        type: latestDraft.type,
        status: latestDraft.status,
        startTime: latestDraft.start_time,
      }
      const slotToRoster: Record<string, number> = latestDraft.slot_to_roster_id || {}
      for (const [slot, rosterId] of Object.entries(slotToRoster)) {
        draftSlotMap[rosterId] = parseInt(slot)
      }
    }

    let allMatchups: { week: number; matchups: SleeperMatchup[] }[] = []
    for (let week = 1; week <= 18; week++) {
      const weekMatchups = await fetchSleeperData(`https://api.sleeper.app/v1/league/${cleanId}/matchups/${week}`)
      if (weekMatchups && weekMatchups.length > 0) {
        allMatchups.push({ week, matchups: weekMatchups })
      }
    }

    let previousSeasons: { season: string; league: SleeperLeague }[] = []
    let prevId = league.previous_league_id
    while (prevId) {
      const prevLeague = await fetchSleeperData(`https://api.sleeper.app/v1/league/${prevId}`)
      if (prevLeague) {
        previousSeasons.push({ season: prevLeague.season, league: prevLeague })
        prevId = prevLeague.previous_league_id
      } else {
        break
      }
      if (previousSeasons.length >= 10) break
    }

    const playerMap: Record<string, { name: string; position: string; team: string }> = {}

    const allRosteredIds = new Set<string>()
    rosters?.forEach(r => {
      r.players?.forEach(pid => allRosteredIds.add(pid))
      r.starters?.forEach(pid => { if (pid && pid !== '0') allRosteredIds.add(pid) })
    })

    try {
      const sleeperPlayers = await getAllPlayers()
      allRosteredIds.forEach(pid => {
        const sp = sleeperPlayers[pid]
        if (sp) {
          playerMap[pid] = {
            name: sp.full_name || `${sp.first_name || ''} ${sp.last_name || ''}`.trim(),
            position: sp.position || '',
            team: sp.team || '',
          }
        }
      })
    } catch {
      if (draftPicks && draftPicks.length > 0) {
        draftPicks.forEach(p => {
          if (p.player_id && p.metadata) {
            playerMap[p.player_id] = {
              name: `${p.metadata.first_name || ''} ${p.metadata.last_name || ''}`.trim(),
              position: p.metadata.position || '',
              team: p.metadata.team || '',
            }
          }
        })
      }
    }

    const managers = rosters?.map(roster => {
      const user = rosterToUser[roster.roster_id]
      return {
        rosterId: roster.roster_id,
        ownerId: roster.owner_id,
        username: user?.username || 'Unknown',
        displayName: user?.display_name || user?.username || 'Unknown',
        avatar: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
        wins: roster.settings?.wins || 0,
        losses: roster.settings?.losses || 0,
        ties: roster.settings?.ties || 0,
        pointsFor: ((roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100).toFixed(2),
        rosterSize: roster.players?.length || 0,
        starters: roster.starters || [],
        players: roster.players || [],
        reserve: roster.reserve || [],
        taxi: roster.taxi || [],
        draftSlot: draftSlotMap[roster.roster_id] || null,
      }
    }) || []

    const leagueType = league.settings?.type === 2 ? 'Dynasty' : league.settings?.type === 1 ? 'Keeper' : 'Redraft'
    const ppr = league.scoring_settings?.rec || 0
    const superflex = league.roster_positions?.filter(p => p === 'SUPER_FLEX').length || 0
    const tep = league.scoring_settings?.bonus_rec_te || 0

    // Generate AI storylines based on league history
    let storylines: { title: string; description: string; type: string }[] = []
    try {
      const storylinePrompt = `You are a fantasy sports analyst creating exciting storylines for an upcoming 2025 fantasy football season.

League: "${league.name}"
Type: ${leagueType}
Seasons of history: ${previousSeasons.length + 1}
Number of teams: ${managers.length}
Total trades this season: ${trades.length}

Managers and their records:
${managers.map(m => `- ${m.displayName}: ${m.wins}-${m.losses}${m.ties ? `-${m.ties}` : ''} (${m.pointsFor} pts)`).join('\n')}

Based on this league data, generate 3-5 compelling storylines for the 2025 season. Each storyline should:
- Reference specific managers by name when relevant
- Create narratives around rivalries, redemption arcs, dynasty builders, etc.
- Be engaging and fun to read
- Feel personalized to this specific league

Return JSON array with objects containing: title (short catchy headline), description (2-3 sentences), type (one of: rivalry, redemption, contender, underdog, dynasty, trade_war, sleeper)

Example format:
[{"title": "The Rematch", "description": "After losing in last year's championship...", "type": "rivalry"}]`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: storylinePrompt }],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      })

      const content = completion.choices[0]?.message?.content
      if (content) {
        const parsed = JSON.parse(content)
        storylines = parsed.storylines || parsed.stories || (Array.isArray(parsed) ? parsed : [])
      }
    } catch (err) {
      console.error('Storyline generation error:', err)
      // Fallback storylines if AI fails
      storylines = [
        { title: 'The Championship Chase', description: `With ${previousSeasons.length + 1} seasons of history, ${league.name} enters 2025 with established rivalries and unfinished business.`, type: 'contender' },
        { title: 'Trade Season Heats Up', description: `${trades.length} trades already this season shows this league means business. Who will make the move that defines the 2025 campaign?`, type: 'trade_war' },
        { title: 'New Season, New Hope', description: `${managers.length} managers ready to compete. Last year's struggles are forgotten—2025 is a fresh start for everyone.`, type: 'redemption' },
      ]
    }

    const transferPreview = {
      league: {
        id: league.league_id,
        name: league.name,
        sport: league.sport?.toUpperCase() || 'NFL',
        season: league.season,
        type: leagueType,
        status: league.status,
        teamCount: league.total_rosters || league.settings?.num_teams || 0,
        playoffTeams: league.settings?.playoff_teams || 0,
        avatar: league.avatar ? `https://sleepercdn.com/avatars/thumbs/${league.avatar}` : null,
        settings: {
          ppr,
          superflex: superflex > 0,
          tep: tep > 0,
        },
        scoringSettings: league.scoring_settings || {},
      },
      managers,
      stats: {
        totalSeasons: previousSeasons.length + 1,
        totalTrades: trades.length,
        totalDraftPicks: draftPicks.length,
        totalMatchups: allMatchups.reduce((sum, w) => sum + w.matchups.length, 0),
        previousSeasons: previousSeasons.map(s => s.season),
      },
      recentTrades: trades.slice(0, 5).map(t => {
        const rosterIds = t.roster_ids || []
        const sides: Record<number, { players: { id: string; name: string; pos: string; team: string }[]; picks: number }> = {}
        rosterIds.forEach(rid => { sides[rid] = { players: [], picks: 0 } })

        if (t.adds) {
          for (const [pid, ridStr] of Object.entries(t.adds)) {
            const rid = parseInt(ridStr)
            if (!sides[rid]) sides[rid] = { players: [], picks: 0 }
            const p = playerMap[pid]
            sides[rid].players.push({
              id: pid,
              name: p?.name || pid,
              pos: p?.position || '',
              team: p?.team || '',
            })
          }
        }
        if (t.draft_picks) {
          t.draft_picks.forEach((dp: any) => {
            const rid = dp.owner_id
            if (rid && sides[rid]) sides[rid].picks++
            else if (rid) sides[rid] = { players: [], picks: 1 }
          })
        }

        const tradeSides = rosterIds.map(rid => {
          const user = rosterToUser[rid]
          return {
            rosterId: rid,
            username: user?.display_name || user?.username || 'Unknown',
            avatar: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
            receives: sides[rid] || { players: [], picks: 0 },
          }
        })

        return {
          id: t.transaction_id,
          created: t.created,
          teamsInvolved: rosterIds.length,
          sides: tradeSides,
          playersAdded: t.adds ? Object.keys(t.adds).length : 0,
          playersDropped: t.drops ? Object.keys(t.drops).length : 0,
          draftPicks: t.draft_picks?.length || 0,
        }
      }),
      recentDraft: draftPicks.slice(0, 10).map(p => ({
        round: p.round,
        pick: p.pick_no,
        playerId: p.player_id,
        playerName: p.metadata ? `${p.metadata.first_name} ${p.metadata.last_name}` : p.player_id,
        position: p.metadata?.position || '',
        team: p.metadata?.team || '',
      })),
      rosterPositions: league.roster_positions || [],
      playerMap,
      draftInfo,
      storylines,
    }

    return NextResponse.json({
      success: true,
      preview: transferPreview,
      message: `Found "${league.name}" with ${managers.length} managers and ${previousSeasons.length + 1} seasons of history.`
    })

  } catch (error: any) {
    console.error('Transfer error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch league data' },
      { status: 500 }
    )
  }
})
