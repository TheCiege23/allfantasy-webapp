import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { searchCFBPlayers, getDevyValuesForPlayers, getCFBTeamRoster, getTeamDevyRoster, DevyPlayerValue } from '@/lib/cfb-player-data'
import { prisma } from '@/lib/prisma'

export const GET = withApiUsage({ endpoint: "/api/legacy/cfb-players", tool: "LegacyCfbPlayers" })(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action') || 'search'
  const query = searchParams.get('q') || searchParams.get('query')
  const team = searchParams.get('team')
  const username = searchParams.get('username')
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined

  try {
    // Action: search - Search for CFB players by name
    if (action === 'search' && query) {
      const players = await searchCFBPlayers(query)
      return NextResponse.json({ players })
    }

    // Action: roster - Get full team roster with devy values
    if (action === 'roster' && team) {
      const roster = await getTeamDevyRoster(team, year)
      return NextResponse.json({ roster })
    }

    // Action: values - Get devy values for specific players
    if (action === 'values') {
      const playerNames = searchParams.get('players')?.split(',') || []
      
      if (playerNames.length === 0) {
        return NextResponse.json({ error: 'No players specified' }, { status: 400 })
      }

      const players = playerNames.map(name => ({
        name: name.trim(),
        position: 'Unknown',
        team: 'Unknown',
      }))

      const values = await getDevyValuesForPlayers(players)
      return NextResponse.json({ values })
    }

    // Action: fantrax-roster - Get Fantrax league roster with devy values
    if (action === 'fantrax-roster' && username) {
      // Get user's Fantrax leagues
      const fantraxUser = await prisma.fantraxUser.findFirst({
        where: { fantraxUsername: { equals: username, mode: 'insensitive' } },
        include: { leagues: true },
      })

      if (!fantraxUser || fantraxUser.leagues.length === 0) {
        return NextResponse.json({ 
          error: 'No Fantrax leagues found',
          roster: [],
        })
      }

      // Get the latest devy league
      const devyLeagues = fantraxUser.leagues.filter((l: { isDevy: boolean }) => l.isDevy)
      const league = devyLeagues.length > 0 ? devyLeagues[0] : fantraxUser.leagues[0]
      
      // Parse roster from league's roster field (Json?)
      const rosterJson = (league as any).roster
      const rosterData = (Array.isArray(rosterJson) ? rosterJson : []) as Array<{
        name: string
        position: string
        nflTeam: string
        year?: string
        fantasyPoints?: number
      }>

      // Get devy values for each player
      const enrichedRoster: Array<DevyPlayerValue & { fantasyPoints?: number }> = []

      for (const player of rosterData.slice(0, 50)) { // Limit to 50 players for performance
        const cfbPlayers = await searchCFBPlayers(player.name)
        const cfbPlayer = cfbPlayers.find(p => 
          p.fullName.toLowerCase().includes(player.name.toLowerCase().split(' ')[0])
        )

        if (cfbPlayer) {
          enrichedRoster.push({
            name: cfbPlayer.fullName,
            team: cfbPlayer.team,
            position: cfbPlayer.position || player.position,
            classYear: cfbPlayer.year === 1 ? 'FR' : cfbPlayer.year === 2 ? 'SO' : cfbPlayer.year === 3 ? 'JR' : cfbPlayer.year === 4 ? 'SR' : 'Unknown',
            devyValue: calculateQuickDevyValue(cfbPlayer.position || player.position, cfbPlayer.year),
            projectedNFLValue: null,
            draftEligibleYear: new Date().getFullYear() + Math.max(0, 4 - (cfbPlayer.year || 3)),
            projectedRound: null,
            trend: 'stable',
            notes: null,
            fantasyPoints: player.fantasyPoints,
          })
        } else {
          // Use parsed Fantrax data as fallback
          const classYear = player.year || 'JR'
          const classYearNum = classYear === 'FR' ? 1 : classYear === 'SO' ? 2 : classYear === 'JR' ? 3 : 4
          
          enrichedRoster.push({
            name: player.name,
            team: player.nflTeam || 'Unknown',
            position: player.position,
            classYear,
            devyValue: calculateQuickDevyValue(player.position, classYearNum),
            projectedNFLValue: null,
            draftEligibleYear: new Date().getFullYear() + Math.max(0, 4 - classYearNum),
            projectedRound: null,
            trend: 'stable',
            notes: null,
            fantasyPoints: player.fantasyPoints,
          })
        }
      }

      return NextResponse.json({
        league: {
          name: league.leagueName,
          season: league.season,
          teamCount: league.teamCount,
          isDevy: league.isDevy,
        },
        roster: enrichedRoster,
      })
    }

    return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 })

  } catch (error) {
    console.error('CFB players API error:', error)
    return NextResponse.json({ error: 'Failed to fetch CFB player data' }, { status: 500 })
  }
})

function calculateQuickDevyValue(position: string, classYear: number | null): number {
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

  let value = baseValues[position] || 2000

  // Class year multiplier
  const multipliers: Record<number, number> = { 1: 1.4, 2: 1.3, 3: 1.1, 4: 1.0, 5: 0.9 }
  value *= multipliers[classYear || 4] || 1.0

  return Math.round(value)
}
