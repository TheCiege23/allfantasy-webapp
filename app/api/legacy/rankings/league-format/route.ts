import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface PositionData {
  position: string
  rank: number
  war: number
  color: string
  marketValue: number
}

interface PositionWARCurve {
  position: string
  color: string
  data: { rank: number; war: number }[]
}

export const POST = withApiUsage({ endpoint: "/api/legacy/rankings/league-format", tool: "LegacyRankingsLeagueFormat" })(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { sleeper_username, league_id } = body

    if (!sleeper_username || !league_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const user = await prisma.legacyUser.findUnique({
      where: { sleeperUsername: sleeper_username.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [leagueRes, rostersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${league_id}`),
      fetch(`https://api.sleeper.app/v1/league/${league_id}/rosters`),
    ])

    if (!leagueRes.ok || !rostersRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch league data' }, { status: 500 })
    }

    const leagueData = await leagueRes.json()
    const rosters = await rostersRes.json()

    const settings = leagueData.scoring_settings || {}
    const isPPR = (settings.rec || 0) >= 1
    const isHalfPPR = (settings.rec || 0) === 0.5
    const hasTEP = (settings.bonus_rec_te || 0) > 0
    
    const rosterPositions = leagueData.roster_positions || []
    const isSF = rosterPositions.filter((p: string) => p === 'QB' || p === 'SUPER_FLEX').length >= 2
    
    const qbSlots = rosterPositions.filter((p: string) => p === 'QB').length
    const rbSlots = rosterPositions.filter((p: string) => p === 'RB').length
    const wrSlots = rosterPositions.filter((p: string) => p === 'WR').length
    const teSlots = rosterPositions.filter((p: string) => p === 'TE').length
    const flexSlots = rosterPositions.filter((p: string) => p === 'FLEX').length
    const sfSlots = rosterPositions.filter((p: string) => p === 'SUPER_FLEX').length

    const positionColors: Record<string, string> = {
      QB: '#00CED1',
      RB: '#FF6B6B',
      WR: '#AA96DA',
      TE: '#F38181',
    }

    const generateWARCurve = (position: string, startWAR: number, decay: number, count: number = 50) => {
      const curve: { rank: number; war: number }[] = []
      for (let i = 1; i <= count; i++) {
        let war = startWAR * Math.pow(decay, i - 1)
        
        if (position === 'QB' && !isSF) {
          war = war * 0.7
        } else if (position === 'QB' && isSF) {
          war = war * 1.3
        }
        
        if (position === 'TE' && hasTEP) {
          war = war * 1.2
        }
        
        if (position === 'RB' && isPPR) {
          war = war * 0.9
        } else if (position === 'WR' && isPPR) {
          war = war * 1.1
        }
        
        war = Math.max(war, -0.5)
        curve.push({ rank: i, war: Math.round(war * 100) / 100 })
      }
      return curve
    }

    const warCurves: PositionWARCurve[] = [
      { position: 'QB', color: positionColors.QB, data: generateWARCurve('QB', 2.5, 0.94) },
      { position: 'RB', color: positionColors.RB, data: generateWARCurve('RB', 2.0, 0.91) },
      { position: 'WR', color: positionColors.WR, data: generateWARCurve('WR', 2.2, 0.93) },
      { position: 'TE', color: positionColors.TE, data: generateWARCurve('TE', 1.5, 0.88) },
    ]

    const generateScatterData = () => {
      const data: PositionData[] = []
      const positions = ['QB', 'RB', 'WR', 'TE']
      
      positions.forEach(pos => {
        const count = pos === 'QB' ? 35 : pos === 'TE' ? 30 : 50
        for (let i = 0; i < count; i++) {
          const baseValue = Math.random() * 10000 + 500
          
          let warMultiplier = 1
          if (pos === 'QB') warMultiplier = isSF ? 1.3 : 0.8
          if (pos === 'TE') warMultiplier = hasTEP ? 1.2 : 1
          if (pos === 'WR') warMultiplier = isPPR ? 1.1 : 1
          
          const baseWAR = 3 - (Math.log(i + 1) / Math.log(count)) * 4
          const war = (baseWAR + (Math.random() - 0.5) * 1.5) * warMultiplier
          
          data.push({
            position: pos,
            rank: i + 1,
            war: Math.round(war * 100) / 100,
            color: positionColors[pos],
            marketValue: Math.round(baseValue * (1 - i / count * 0.8)),
          })
        }
      })
      return data
    }

    const scatterData = generateScatterData()

    const formatDescription = [
      `${rosters.length} Team`,
      isPPR ? 'PPR' : isHalfPPR ? 'Half PPR' : 'Standard',
      isSF ? 'Superflex' : '1QB',
      hasTEP ? 'TEP' : null,
    ].filter(Boolean).join(' • ')

    const insights = [
      isSF ? 'QB value significantly elevated due to Superflex format' : 'QB value lower in 1QB format',
      isPPR ? 'WR value boosted in PPR - prioritize target share' : 'RB value elevated in non-PPR',
      hasTEP ? 'Elite TEs carry premium value with TE premium scoring' : 'TE value standard - focus on elite options only',
      `${rbSlots + Math.floor(flexSlots / 2)} RB starters create scarcity at the position`,
      `${wrSlots + Math.ceil(flexSlots / 2)} WR starters provide depth opportunities`,
    ]

    return NextResponse.json({
      warCurves,
      scatterData,
      leagueSettings: {
        name: leagueData.name,
        totalTeams: rosters.length,
        format: formatDescription,
        isPPR,
        isHalfPPR,
        hasTEP,
        isSF,
        qbSlots,
        rbSlots,
        wrSlots,
        teSlots,
        flexSlots,
        sfSlots,
      },
      insights,
      presets: ['WAR View', 'Trade Value', 'ADP Comparison'],
    })
  } catch (error) {
    console.error('League format error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
