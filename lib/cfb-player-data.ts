// CFB Player Data - Integrates with CollegeFootballData.com API for devy player info

export interface CFBPlayer {
  id: number
  firstName: string
  lastName: string
  fullName: string
  team: string
  position: string
  jersey: number | null
  year: number | null  // 1=FR, 2=SO, 3=JR, 4=SR, 5=5th
  height: number | null
  weight: number | null
  hometown: string | null
  homeState: string | null
  homeCountry: string | null
}

export interface CFBPlayerStats {
  playerId: number
  playerName: string
  team: string
  position: string
  passingYards: number
  passingTDs: number
  rushingYards: number
  rushingTDs: number
  receivingYards: number
  receivingTDs: number
  receptions: number
}

export interface DevyPlayerValue {
  name: string
  team: string
  position: string
  classYear: string // FR, SO, JR, SR
  devyValue: number
  projectedNFLValue: number | null
  draftEligibleYear: number
  projectedRound: number | null
  trend: 'rising' | 'falling' | 'stable'
  notes: string | null
}

const CFBD_BASE = 'https://api.collegefootballdata.com'

function getClassYearString(year: number | null): string {
  switch (year) {
    case 1: return 'FR'
    case 2: return 'SO'
    case 3: return 'JR'
    case 4: return 'SR'
    case 5: return '5th'
    default: return 'Unknown'
  }
}

function calculateDraftEligibleYear(classYear: number | null): number {
  const currentYear = new Date().getFullYear()
  if (!classYear) return currentYear + 3
  
  // Players are draft eligible 3 years after high school
  // FR (1) = 3 more years, SO (2) = 2 more, JR (3) = 1 more, SR (4) = this year
  const yearsRemaining = Math.max(0, 4 - classYear)
  return currentYear + yearsRemaining
}

// Calculate devy value based on position, class year, and projected draft capital
function calculateDevyValue(
  position: string,
  classYear: number | null,
  projectedRound: number | null,
  stats?: { passingYards?: number; rushingYards?: number; receivingYards?: number; receptions?: number }
): number {
  const baseValues: Record<string, number> = {
    QB: 6000,
    RB: 4500,
    WR: 5000,
    TE: 3500,
    OL: 1500,
    DL: 1500,
    LB: 1500,
    DB: 1500,
    K: 500,
    P: 300,
  }

  let baseValue = baseValues[position] || 2000

  // Class year multiplier - underclassmen are more valuable in devy
  const classMultipliers: Record<number, number> = {
    1: 1.4,  // FR - high upside
    2: 1.3,  // SO - still developing
    3: 1.1,  // JR - approaching draft
    4: 1.0,  // SR - draft year
    5: 0.9,  // 5th year
  }
  baseValue *= classMultipliers[classYear || 4] || 1.0

  // Projected draft round multiplier
  if (projectedRound) {
    const roundMultipliers: Record<number, number> = {
      1: 1.8,  // 1st round
      2: 1.4,  // 2nd round
      3: 1.1,  // 3rd round
      4: 0.9,  // 4th round
      5: 0.7,  // 5th round
      6: 0.5,  // 6th round
      7: 0.3,  // 7th round
    }
    baseValue *= roundMultipliers[projectedRound] || 0.5
  }

  // Stats boost
  if (stats) {
    if (position === 'QB' && stats.passingYards) {
      baseValue += Math.min(stats.passingYards / 100, 1500)
    }
    if ((position === 'RB') && stats.rushingYards) {
      baseValue += Math.min(stats.rushingYards / 50, 1200)
    }
    if ((position === 'WR' || position === 'TE') && stats.receivingYards) {
      baseValue += Math.min(stats.receivingYards / 50, 1200)
    }
  }

  return Math.round(baseValue)
}

export async function searchCFBPlayers(searchTerm: string): Promise<CFBPlayer[]> {
  const apiKey = process.env.CFBD_KEY
  if (!apiKey) {
    console.error('CFBD_KEY not found')
    return []
  }

  try {
    const response = await fetch(
      `${CFBD_BASE}/player/search?searchTerm=${encodeURIComponent(searchTerm)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('CFBD player search failed:', response.status)
      return []
    }

    const data = await response.json()
    return data.map((p: any) => {
      const fn = p.firstName || p.first_name || ''
      const ln = p.lastName || p.last_name || ''
      return {
        id: p.id,
        firstName: fn,
        lastName: ln,
        fullName: `${fn} ${ln}`,
        team: p.team,
        position: p.position,
        jersey: p.jersey,
        year: p.year,
        height: p.height,
        weight: p.weight,
        hometown: p.homeCity || p.hometown || null,
        homeState: p.homeState || p.home_state || null,
        homeCountry: p.homeCountry || p.home_country || null,
      }
    })
  } catch (error) {
    console.error('CFBD player search error:', error)
    return []
  }
}

export async function getCFBPlayerStats(year: number, team?: string): Promise<CFBPlayerStats[]> {
  const apiKey = process.env.CFBD_KEY
  if (!apiKey) return []

  try {
    let url = `${CFBD_BASE}/stats/player/season?year=${year}`
    if (team) url += `&team=${encodeURIComponent(team)}`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) return []

    const data = await response.json()
    
    // Aggregate stats by player
    const playerMap = new Map<string, CFBPlayerStats>()
    
    for (const stat of data) {
      const key = `${stat.player}-${stat.team}`
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          playerId: stat.playerId,
          playerName: stat.player,
          team: stat.team,
          position: stat.category === 'passing' ? 'QB' : 
                   stat.category === 'rushing' ? 'RB' :
                   stat.category === 'receiving' ? 'WR' : '',
          passingYards: 0,
          passingTDs: 0,
          rushingYards: 0,
          rushingTDs: 0,
          receivingYards: 0,
          receivingTDs: 0,
          receptions: 0,
        })
      }
      
      const player = playerMap.get(key)!
      
      if (stat.statType === 'YDS') {
        if (stat.category === 'passing') player.passingYards = parseInt(stat.stat) || 0
        if (stat.category === 'rushing') player.rushingYards = parseInt(stat.stat) || 0
        if (stat.category === 'receiving') player.receivingYards = parseInt(stat.stat) || 0
      }
      if (stat.statType === 'TD') {
        if (stat.category === 'passing') player.passingTDs = parseInt(stat.stat) || 0
        if (stat.category === 'rushing') player.rushingTDs = parseInt(stat.stat) || 0
        if (stat.category === 'receiving') player.receivingTDs = parseInt(stat.stat) || 0
      }
      if (stat.statType === 'REC') {
        player.receptions = parseInt(stat.stat) || 0
      }
    }

    return Array.from(playerMap.values())
  } catch (error) {
    console.error('CFBD stats error:', error)
    return []
  }
}

export interface CFBDraftPick {
  collegeId: number | null
  collegeName: string
  collegeTeam: string
  collegeConference: string | null
  nflTeam: string
  year: number
  round: number
  pick: number
  overallPick: number
  position: string
  playerName: string
  height: number | null
  weight: number | null
}

export async function getCFBDraftPicks(year: number, college?: string): Promise<CFBDraftPick[]> {
  const apiKey = process.env.CFBD_KEY
  if (!apiKey) return []

  try {
    let url = `${CFBD_BASE}/draft/picks?year=${year}`
    if (college) url += `&college=${encodeURIComponent(college)}`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('[CFBD] Draft picks fetch failed:', response.status)
      return []
    }

    const data = await response.json()
    return data.map((p: any) => ({
      collegeId: p.collegeAthleteId || p.collegeId || null,
      collegeName: p.name || '',
      collegeTeam: p.collegeTeam || p.college || '',
      collegeConference: p.collegeConference || null,
      nflTeam: p.nflTeam || '',
      year: p.year,
      round: p.round,
      pick: p.pick,
      overallPick: p.overall || p.pick,
      position: p.position || '',
      playerName: p.name || '',
      height: p.height || null,
      weight: p.weight || null,
    }))
  } catch (error) {
    console.error('[CFBD] Draft picks error:', String(error))
    return []
  }
}

export async function getCFBTeamRoster(team: string, year?: number): Promise<CFBPlayer[]> {
  const apiKey = process.env.CFBD_KEY
  if (!apiKey) return []

  try {
    const rosterYear = year || new Date().getFullYear()
    const response = await fetch(
      `${CFBD_BASE}/roster?team=${encodeURIComponent(team)}&year=${rosterYear}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) return []

    const data = await response.json()
    return data
      .filter((p: any) => {
        const fn = p.firstName || p.first_name
        const ln = p.lastName || p.last_name
        return fn && ln && fn !== 'undefined' && ln !== 'undefined'
      })
      .map((p: any) => {
        const fn = p.firstName || p.first_name || ''
        const ln = p.lastName || p.last_name || ''
        return {
          id: p.id,
          firstName: fn,
          lastName: ln,
          fullName: `${fn} ${ln}`,
          team: team,
          position: p.position,
          jersey: p.jersey,
          year: p.year,
          height: p.height,
          weight: p.weight,
          hometown: p.homeCity || p.home_town || null,
          homeState: p.homeState || p.home_state || null,
          homeCountry: p.homeCountry || p.home_country || null,
        }
      })
  } catch (error) {
    console.error('CFBD roster error:', error)
    return []
  }
}

export function enrichFantraxPlayerWithDevyValue(
  player: { name: string; position: string; nflTeam: string; year?: string },
  stats?: CFBPlayerStats,
  projectedRound?: number
): DevyPlayerValue {
  // Parse class year from string like "JR", "SR", etc.
  const classYearMap: Record<string, number> = {
    'FR': 1, 'Freshman': 1, '1': 1,
    'SO': 2, 'Sophomore': 2, '2': 2,
    'JR': 3, 'Junior': 3, '3': 3,
    'SR': 4, 'Senior': 4, '4': 4,
    '5th': 5, 'RS': 4, 'Redshirt': 4,
  }
  
  const classYearNum = classYearMap[player.year || 'JR'] || 3
  const classYear = getClassYearString(classYearNum)
  
  const devyValue = calculateDevyValue(
    player.position,
    classYearNum,
    projectedRound || null,
    stats ? {
      passingYards: stats.passingYards,
      rushingYards: stats.rushingYards,
      receivingYards: stats.receivingYards,
      receptions: stats.receptions,
    } : undefined
  )

  // Estimate projected NFL value (roughly 1.5-2x devy value for top prospects)
  const projectedNFLValue = projectedRound && projectedRound <= 3 
    ? Math.round(devyValue * 1.8)
    : null

  return {
    name: player.name,
    team: player.nflTeam, // In devy context, this is the college team
    position: player.position,
    classYear,
    devyValue,
    projectedNFLValue,
    draftEligibleYear: calculateDraftEligibleYear(classYearNum),
    projectedRound: projectedRound || null,
    trend: 'stable',
    notes: null,
  }
}

// Get devy values for a list of player names
export async function getDevyValuesForPlayers(
  players: Array<{ name: string; position: string; team: string; year?: string }>
): Promise<DevyPlayerValue[]> {
  const results: DevyPlayerValue[] = []

  for (const player of players) {
    // Search for player in CFBD to get accurate info
    const cfbResults = await searchCFBPlayers(player.name)
    const cfbPlayer = cfbResults.find(p => 
      p.fullName.toLowerCase() === player.name.toLowerCase() ||
      `${p.firstName} ${p.lastName}`.toLowerCase() === player.name.toLowerCase()
    )

    if (cfbPlayer) {
      const devyValue = calculateDevyValue(
        cfbPlayer.position || player.position,
        cfbPlayer.year,
        null // No projected round data from CFBD
      )

      results.push({
        name: cfbPlayer.fullName,
        team: cfbPlayer.team,
        position: cfbPlayer.position || player.position,
        classYear: getClassYearString(cfbPlayer.year),
        devyValue,
        projectedNFLValue: null,
        draftEligibleYear: calculateDraftEligibleYear(cfbPlayer.year),
        projectedRound: null,
        trend: 'stable',
        notes: null,
      })
    } else {
      // Use provided data if CFBD search fails
      results.push(enrichFantraxPlayerWithDevyValue(
        { name: player.name, position: player.position, nflTeam: player.team, year: player.year }
      ))
    }
  }

  return results
}

// Batch fetch for performance - get all players from a team
export async function getTeamDevyRoster(team: string, year?: number): Promise<DevyPlayerValue[]> {
  const roster = await getCFBTeamRoster(team, year)
  
  return roster
    .filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position))
    .map(p => ({
      name: p.fullName,
      team: p.team,
      position: p.position,
      classYear: getClassYearString(p.year),
      devyValue: calculateDevyValue(p.position, p.year, null),
      projectedNFLValue: null,
      draftEligibleYear: calculateDraftEligibleYear(p.year),
      projectedRound: null,
      trend: 'stable' as const,
      notes: null,
    }))
}
