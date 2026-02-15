import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI()

interface DevyBoardRequest {
  league_id: string
  user_id?: string
  league_settings?: {
    scoring_type?: string
    is_superflex?: boolean
    te_premium?: boolean
    roster_positions?: string[]
    total_teams?: number
    league_type?: string
  }
  roster?: {
    players?: Array<{ name: string; position: string; age?: number }>
    picks?: Array<{ round: number; pick: number; original_owner?: string }>
  }
  team_record?: { wins: number; losses: number }
}

interface DevyPlayer {
  name: string
  position: string
  school: string
  tier: 'Tier 1' | 'Tier 2' | 'Sleeper'
  draftValue: number
  availabilityPct: number
  whyBullets: string[]
  needMatch: 'Strong' | 'Medium' | 'Low'
}

interface DevyBoardResponse {
  updatedAt: string
  confidence: 'High' | 'Learning' | 'Evolving'
  leagueContext: {
    format: string
    teams: number
    scoring: string
    yourPick: string
    teamDirection: string
    biggestNeed: string
  }
  topTargets: DevyPlayer[]
  fallbacks: DevyPlayer[]
  projectedPicksAhead: Array<{ name: string; pct: number }>
  updateReasons: string[]
}

export const POST = withApiUsage({ endpoint: "/api/legacy/devy-board", tool: "LegacyDevyBoard" })(async (req: NextRequest) => {
  try {
    const body: DevyBoardRequest = await req.json()
    const { league_id, league_settings, roster, team_record } = body

    if (!league_id) {
      return NextResponse.json({ error: 'league_id is required' }, { status: 400 })
    }

    const totalTeams = league_settings?.total_teams || 12
    const isSF = league_settings?.is_superflex || false
    const isTEP = league_settings?.te_premium || false
    const leagueType = league_settings?.league_type || 'dynasty'
    
    const userPicks = roster?.picks || []
    const firstPick = userPicks.length > 0 
      ? `${userPicks[0].round}.${String(userPicks[0].pick).padStart(2, '0')}`
      : '1.08'
    
    const record = team_record || { wins: 5, losses: 7 }
    const isContender = record.wins > record.losses
    const teamDirection = isContender ? 'Contender' : 'Rebuilder'
    
    const rosterPositions = roster?.players?.map(p => p.position) || []
    const qbCount = rosterPositions.filter(p => p === 'QB').length
    const rbCount = rosterPositions.filter(p => p === 'RB').length
    const wrCount = rosterPositions.filter(p => p === 'WR').length
    const teCount = rosterPositions.filter(p => p === 'TE').length
    
    let biggestNeed = 'WR'
    if (isSF && qbCount < 2) biggestNeed = 'QB'
    else if (rbCount < 3) biggestNeed = 'RB'
    else if (teCount < 1 && isTEP) biggestNeed = 'TE'

    // Current date context for accurate recommendations
    const currentYear = new Date().getFullYear() // 2026
    const currentMonth = new Date().getMonth() + 1 // February
    
    const prompt = `You are a fantasy football devy draft expert. Today is ${currentMonth}/${currentYear}. Generate draft recommendations for a ${leagueType} league.

CRITICAL: The 2024 and 2025 NFL Drafts have already occurred. DO NOT recommend any players who were drafted in 2024 or 2025 NFL drafts. These players are now in the NFL:
- 2024 Draft: Caleb Williams, Jayden Daniels, Drake Maye, Marvin Harrison Jr., Malik Nabers, Rome Odunze, Brock Bowers, Brian Thomas Jr., Xavier Worthy, Keon Coleman, Ladd McConkey, Trey Benson, Jaylen Wright, Bucky Irving, Blake Corum, MarShawn Lloyd, Jonathon Brooks, Braelon Allen, Ray Davis, Audric Estime, Will Shipley, etc.
- 2025 Draft: Travis Hunter, Ashton Jeanty, Cam Ward, Shedeur Sanders, Tetairoa McMillan, Luther Burden III, Emeka Egbuka, Matthew Golden, Quinshon Judkins, Omarion Hampton, Kalel Mullings, TreVeyon Henderson, etc.

Only recommend college players who are CURRENTLY still in college for the ${currentYear} season and will be draft-eligible in 2026 or later.

League Context:
- Format: ${leagueType} (${isSF ? 'Superflex' : '1QB'})
- Teams: ${totalTeams}
- TE Premium: ${isTEP ? 'Yes' : 'No'}
- User's Pick: ${firstPick}
- Team Direction: ${teamDirection}
- Biggest Roster Need: ${biggestNeed}

Generate exactly this JSON structure with CURRENT ${currentYear}-${currentYear + 1} devy prospects still in college:
{
  "topTargets": [
    {
      "name": "Player Name",
      "position": "QB/RB/WR/TE",
      "school": "University Name",
      "tier": "Tier 1" or "Tier 2" or "Sleeper",
      "draftValue": 85,
      "availabilityPct": 70,
      "whyBullets": ["Reason 1 about roster fit", "Reason 2 about production/upside"],
      "needMatch": "Strong" or "Medium" or "Low"
    }
  ],
  "fallbacks": [3 backup options with same structure],
  "projectedPicksAhead": [{"name": "Player", "pct": 85}],
  "updateReasons": ["Reason 1 for board changes", "Reason 2", "Reason 3"]
}

Provide 6 topTargets, 3 fallbacks, and 4-6 projectedPicksAhead names.
Consider: ${teamDirection === 'Contender' ? 'More production-ready players' : 'Higher upside, younger prospects'}.
Position priority based on need: ${biggestNeed}.
Return ONLY valid JSON, no markdown.`

    let aiResponse: any = null
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      })
      
      const content = completion.choices[0]?.message?.content || ''
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()
      aiResponse = JSON.parse(cleanedContent)
    } catch (aiError) {
      console.error('AI generation failed, using fallback data:', aiError)
      aiResponse = generateFallbackData(biggestNeed, teamDirection, isSF)
    }

    const response: DevyBoardResponse = {
      updatedAt: new Date().toISOString(),
      confidence: aiResponse ? 'High' : 'Learning',
      leagueContext: {
        format: `${leagueType.charAt(0).toUpperCase() + leagueType.slice(1)}${leagueType.includes('devy') ? '' : '/Devy'}`,
        teams: totalTeams,
        scoring: isSF ? 'Superflex' : '1QB' + (isTEP ? ' / TEP' : ''),
        yourPick: firstPick,
        teamDirection,
        biggestNeed,
      },
      topTargets: aiResponse.topTargets || [],
      fallbacks: aiResponse.fallbacks || [],
      projectedPicksAhead: aiResponse.projectedPicksAhead || [],
      updateReasons: aiResponse.updateReasons || [
        'Initial board generation',
        'Roster needs analyzed',
        'League settings applied',
      ],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Devy board error:', error)
    return NextResponse.json(
      { error: 'Failed to generate devy board' },
      { status: 500 }
    )
  }
})

function generateFallbackData(biggestNeed: string, teamDirection: string, isSF: boolean) {
  // 2026 Draft Class prospects (players currently in college as of 2026)
  // Note: 2024 and 2025 draft classes have already been drafted
  const prospects: Record<string, DevyPlayer[]> = {
    QB: [
      { name: 'Arch Manning', position: 'QB', school: 'Texas', tier: 'Tier 1', draftValue: 95, availabilityPct: 25, whyBullets: ['Elite pedigree and arm talent', 'Perfect SF asset'], needMatch: 'Strong' },
      { name: 'Dylan Raiola', position: 'QB', school: 'Nebraska', tier: 'Tier 1', draftValue: 88, availabilityPct: 40, whyBullets: ['Pro-ready mechanics', 'High football IQ'], needMatch: 'Strong' },
      { name: 'Julian Sayin', position: 'QB', school: 'Ohio State', tier: 'Tier 2', draftValue: 78, availabilityPct: 60, whyBullets: ['Excellent accuracy', 'Rising prospect'], needMatch: 'Medium' },
    ],
    RB: [
      { name: 'Jerrick Gibson', position: 'RB', school: 'LSU', tier: 'Tier 1', draftValue: 90, availabilityPct: 35, whyBullets: ['Elite speed and vision', 'Workhorse potential'], needMatch: 'Strong' },
      { name: 'Quinten Joyner', position: 'RB', school: 'USC', tier: 'Tier 1', draftValue: 85, availabilityPct: 45, whyBullets: ['Complete skillset', 'Pass-catching ability'], needMatch: 'Strong' },
      { name: 'Rueben Owens', position: 'RB', school: 'Louisville', tier: 'Tier 2', draftValue: 75, availabilityPct: 55, whyBullets: ['Explosive athlete', 'Breakout potential'], needMatch: 'Medium' },
    ],
    WR: [
      { name: 'Jeremiah Smith', position: 'WR', school: 'Ohio State', tier: 'Tier 1', draftValue: 98, availabilityPct: 15, whyBullets: ['Generational talent', 'Elite size/speed combo'], needMatch: 'Strong' },
      { name: 'Ryan Williams', position: 'WR', school: 'Alabama', tier: 'Tier 1', draftValue: 92, availabilityPct: 30, whyBullets: ['Dynamic playmaker', 'Already producing'], needMatch: 'Strong' },
      { name: 'Dakorien Moore', position: 'WR', school: 'LSU', tier: 'Tier 2', draftValue: 82, availabilityPct: 50, whyBullets: ['Explosive athlete', 'Big play threat'], needMatch: 'Medium' },
    ],
    TE: [
      { name: 'Duce Robinson', position: 'TE', school: 'USC', tier: 'Tier 1', draftValue: 85, availabilityPct: 45, whyBullets: ['Elite athleticism', 'Pro-ready frame'], needMatch: 'Strong' },
      { name: 'Jackson Carver', position: 'TE', school: 'Texas', tier: 'Tier 2', draftValue: 75, availabilityPct: 55, whyBullets: ['Reliable target', 'Good blocker'], needMatch: 'Medium' },
      { name: 'Eli Raridon', position: 'TE', school: 'Notre Dame', tier: 'Tier 2', draftValue: 72, availabilityPct: 65, whyBullets: ['Rising prospect', 'Soft hands'], needMatch: 'Medium' },
    ],
  }

  const needProspects = prospects[biggestNeed] || prospects.WR
  const otherPositions = Object.keys(prospects).filter(p => p !== biggestNeed)
  
  const topTargets = [
    ...needProspects.slice(0, 3),
    ...prospects[otherPositions[0]]?.slice(0, 2) || [],
    ...prospects[otherPositions[1]]?.slice(0, 1) || [],
  ].slice(0, 6)

  const fallbacks = [
    { name: 'Johntay Cook II', position: 'WR', school: 'Texas', tier: 'Sleeper' as const, draftValue: 68, availabilityPct: 75, whyBullets: ['Big play ability', 'Value pick'], needMatch: 'Low' as const },
    { name: 'Peyton ONeil', position: 'RB', school: 'USC', tier: 'Tier 2' as const, draftValue: 70, availabilityPct: 70, whyBullets: ['Underrated talent', 'Safe floor'], needMatch: 'Medium' as const },
    { name: 'Kyion Grayes', position: 'WR', school: 'Alabama', tier: 'Tier 2' as const, draftValue: 65, availabilityPct: 80, whyBullets: ['Route technician', 'Good value'], needMatch: 'Low' as const },
  ]

  const projectedPicksAhead = [
    { name: 'Jeremiah Smith', pct: 95 },
    { name: 'Arch Manning', pct: 90 },
    { name: 'Ryan Williams', pct: 85 },
    { name: 'Jerrick Gibson', pct: 80 },
    { name: 'Dylan Raiola', pct: 75 },
  ]

  return {
    topTargets,
    fallbacks,
    projectedPicksAhead,
    updateReasons: [
      `${biggestNeed} prioritized based on roster analysis`,
      `${teamDirection} strategy applied to rankings`,
      isSF ? 'Superflex QB premium factored in' : 'Standard QB valuation applied',
    ],
  }
}
