import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' })

interface PlayoffProbability {
  makePlayoffs: number
  makeSemiFinals: number
  makeFinals: number
  winFinals: number
}

interface TeamForecast {
  userId: string
  teamName: string
  sleeperUsername: string
  teamRating: number
  currentRecord: string
  isUser: boolean
  probabilities: PlayoffProbability
  aiRecommendations?: string[]
}

export const POST = withApiUsage({ endpoint: "/api/legacy/rankings/playoff-forecast", tool: "LegacyRankingsPlayoffForecast" })(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { sleeper_username, league_id, forecast_year, forecast_type = 'traditional' } = body

    if (!sleeper_username || !league_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const user = await prisma.legacyUser.findUnique({
      where: { sleeperUsername: sleeper_username.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [leagueRes, rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${league_id}`),
      fetch(`https://api.sleeper.app/v1/league/${league_id}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${league_id}/users`),
    ])

    if (!leagueRes.ok || !rostersRes.ok || !usersRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch league data' }, { status: 500 })
    }

    const leagueData = await leagueRes.json()
    const rosters = await rostersRes.json()
    const users = await usersRes.json()

    const userMap = new Map(users.map((u: any) => [u.user_id, u]))
    const currentSeason = parseInt(leagueData.season) || new Date().getFullYear()
    const targetYear = forecast_year || currentSeason
    const yearDiff = targetYear - currentSeason

    const totalTeams = rosters.length
    const playoffSpots = leagueData.settings?.playoff_teams || Math.ceil(totalTeams / 2)

    const teamForecasts: TeamForecast[] = rosters.map((roster: any, idx: number) => {
      const ownerInfo: any = userMap.get(roster.owner_id)
      const teamName = ownerInfo?.display_name || `Team ${roster.roster_id}`
      const sleeperUsername = ownerInfo?.display_name || ''
      
      const wins = roster.settings?.wins || 0
      const losses = roster.settings?.losses || 0
      const fpts = (roster.settings?.fpts || 0) + ((roster.settings?.fpts_decimal || 0) / 100)
      
      const playerCount = roster.players?.length || 0
      const baseRating = 1000 + (wins * 15) - (losses * 10) + (fpts / 100)
      
      let teamRating: number
      if (forecast_type === 'elo') {
        const eloAdjustment = (fpts / 100) * 0.3 + (wins - losses) * 5
        teamRating = Math.round(baseRating + (playerCount * 2) + eloAdjustment)
      } else {
        teamRating = Math.round(baseRating + (playerCount * 2))
      }
      
      const allRatings = rosters.map((r: any) => {
        const w = r.settings?.wins || 0
        const l = r.settings?.losses || 0
        const pts = (r.settings?.fpts || 0) + ((r.settings?.fpts_decimal || 0) / 100)
        const pc = r.players?.length || 0
        return 1000 + (w * 15) - (l * 10) + (pts / 100) + (pc * 2)
      })
      allRatings.sort((a: number, b: number) => b - a)
      
      const rank = allRatings.findIndex((r: number) => Math.round(r) === teamRating) + 1
      const percentile = (totalTeams - rank) / (totalTeams - 1)
      
      let makePlayoffs = Math.min(95, Math.max(5, percentile * 100 + 15))
      if (rank <= playoffSpots) {
        makePlayoffs = Math.min(95, makePlayoffs + 20)
      }
      
      if (yearDiff > 0) {
        makePlayoffs = Math.max(10, Math.min(85, makePlayoffs + (Math.random() - 0.5) * 20 * yearDiff))
      }
      
      const makeSemiFinals = makePlayoffs * 0.6
      const makeFinals = makeSemiFinals * 0.55
      const winFinals = makeFinals * 0.5

      return {
        userId: roster.owner_id,
        teamName,
        sleeperUsername,
        teamRating,
        currentRecord: `${wins}-${losses}`,
        isUser: roster.owner_id === user.sleeperUserId,
        probabilities: {
          makePlayoffs: Math.round(makePlayoffs),
          makeSemiFinals: Math.round(makeSemiFinals),
          makeFinals: Math.round(makeFinals),
          winFinals: Math.round(winFinals),
        }
      }
    })

    teamForecasts.sort((a, b) => b.teamRating - a.teamRating)

    const userTeam = teamForecasts.find(t => t.isUser)
    let aiRecommendations: string[] = []
    
    if (userTeam) {
      try {
        const prompt = `As a fantasy sports analyst, provide 3 brief actionable recommendations to improve this team's playoff chances.

Team: ${userTeam.teamName}
Rating: ${userTeam.teamRating}
Record: ${userTeam.currentRecord}
League: ${totalTeams} teams, ${playoffSpots} playoff spots
Forecast Year: ${targetYear}
Current Playoff Probability: ${userTeam.probabilities.makePlayoffs}%

Respond with exactly 3 brief, specific recommendations (1 sentence each). Format as JSON array of strings.`

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
        })

        const content = completion.choices[0]?.message?.content || '[]'
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          aiRecommendations = JSON.parse(jsonMatch[0])
        }
      } catch (err) {
        console.error('AI recommendations error:', err)
        aiRecommendations = [
          'Focus on acquiring young, high-upside players to build long-term value',
          'Target positional depth at your weakest positions',
          'Monitor injury reports and handcuffs for your key players'
        ]
      }
    }

    return NextResponse.json({
      forecasts: teamForecasts,
      leagueInfo: {
        name: leagueData.name,
        totalTeams,
        playoffSpots,
        season: currentSeason,
        forecastYear: targetYear,
      },
      aiRecommendations,
      forecastType: forecast_type === 'elo' ? 'Elo Adjusted ADP Forecast' : 'Traditional ADP Forecast',
    })
  } catch (error) {
    console.error('Playoff forecast error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
