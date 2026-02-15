const ESPN_API_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl'

const ESPN_POS_MAP: Record<number, string> = {
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DEF',
}

const ESPN_SLOT_MAP: Record<number, string> = {
  0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 16: 'D/ST', 17: 'K',
  20: 'Bench', 21: 'IR', 23: 'FLEX', 7: 'OP',
}

const ESPN_TEAM_MAP: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE',
  6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN',
  11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ',
  21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF',
  26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX',
  33: 'BAL', 34: 'HOU',
}

export type EspnTeam = {
  id: number
  name: string
  abbrev: string
  owners: string[]
  record: { wins: number; losses: number; ties: number; pointsFor: number }
  roster: EspnRosterEntry[]
}

export type EspnRosterEntry = {
  playerId: number
  name: string
  position: string
  nflTeam: string
  slot: 'Starter' | 'Bench' | 'IR'
}

export type EspnLeagueData = {
  leagueId: number
  leagueName: string
  seasonId: number
  numTeams: number
  scoringType: string
  teams: EspnTeam[]
}

async function fetchEspnJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) {
    if (res.status === 404) throw new Error('League not found. Make sure the league ID is correct and the league is public.')
    if (res.status === 401) throw new Error('This league is private. Go to ESPN League Settings and enable "Make League Viewable to Public".')
    throw new Error(`ESPN API error: ${res.status}`)
  }
  return res.json()
}

function detectScoringType(scoringItems: any[]): string {
  const recItem = scoringItems.find((i: any) => i.statId === 53)
  if (!recItem) return 'Standard'
  const pts = recItem.points || 0
  if (pts >= 1) return 'PPR'
  if (pts >= 0.5) return 'Half PPR'
  return 'Standard'
}

function slotToRosterSlot(slotId: number): 'Starter' | 'Bench' | 'IR' {
  if (slotId === 20) return 'Bench'
  if (slotId === 21) return 'IR'
  return 'Starter'
}

export async function fetchEspnLeague(leagueId: string | number, season?: number): Promise<EspnLeagueData> {
  const yr = season || new Date().getFullYear()
  const url = `${ESPN_API_BASE}/seasons/${yr}/segments/0/leagues/${leagueId}?view=mRoster&view=mTeam&view=mSettings`

  const data = await fetchEspnJson(url)

  const settings = data.settings || {}
  const leagueName = settings.name || `ESPN League ${leagueId}`
  const numTeams = settings.size || (data.teams || []).length
  const scoringType = detectScoringType(settings.scoringSettings?.scoringItems || [])

  const teams: EspnTeam[] = (data.teams || []).map((t: any) => {
    const overall = t.record?.overall || {}
    const roster: EspnRosterEntry[] = (t.roster?.entries || []).map((e: any) => {
      const player = e.playerPoolEntry?.player || {}
      const posId = player.defaultPositionId || 0
      const proTeamId = player.proTeamId || 0

      return {
        playerId: e.playerId,
        name: player.fullName || `Player ${e.playerId}`,
        position: ESPN_POS_MAP[posId] || 'UNK',
        nflTeam: ESPN_TEAM_MAP[proTeamId] || '',
        slot: slotToRosterSlot(e.lineupSlotId ?? 20),
      }
    })

    return {
      id: t.id,
      name: t.name || t.abbrev || `Team ${t.id}`,
      abbrev: t.abbrev || '',
      owners: t.owners || [],
      record: {
        wins: overall.wins || 0,
        losses: overall.losses || 0,
        ties: overall.ties || 0,
        pointsFor: overall.pointsFor || 0,
      },
      roster,
    }
  })

  return {
    leagueId: Number(leagueId),
    leagueName,
    seasonId: yr,
    numTeams,
    scoringType,
    teams,
  }
}

export function findTeamByName(teams: EspnTeam[], teamName: string): EspnTeam | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/['']/g, "'")
  const target = norm(teamName)
  return (
    teams.find(t => norm(t.name) === target) ||
    teams.find(t => norm(t.name).includes(target) || target.includes(norm(t.name))) ||
    teams.find(t => norm(t.abbrev) === target)
  )
}
