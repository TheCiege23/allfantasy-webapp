import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { openaiChatJson } from '@/lib/openai-client'
import { classifyTeam, type RosterPlayer } from '@/lib/teamClassifier'
import { getRollingInsights } from '@/lib/rolling-insights'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { leagueId, section = 'full' } = body
  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
  }

  const validSections = ['full', 'weekly', 'roster', 'waiver', 'longterm']
  if (!validSections.includes(section)) {
    return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
  }

  try {
    const league = await prisma.league.findFirst({
      where: { platformLeagueId: leagueId },
      include: { rosters: true },
    })

    if (!league) {
      return NextResponse.json({ error: 'League not found. Please sync your league first.' }, { status: 404 })
    }

    const userRoster = league.rosters?.[0]
    const playerData = (userRoster?.playerData as any[] | null) || []
    const rosterPlayers: RosterPlayer[] = playerData.map((p: any) => ({
      playerId: p.playerId || p.id || '',
      position: p.position || '',
      projectedPoints: p.projectedPoints,
      age: p.age,
      isStarter: p.isStarter ?? false,
    }))

    const futurePicksCount = playerData.filter((p: any) => p.type === 'pick' || p.isDraftPick).length

    const teamData = await classifyTeam(leagueId, rosterPlayers, futurePicksCount)

    const playerIds = rosterPlayers.map(p => p.playerId).filter(Boolean)
    const insights = playerIds.length ? await getRollingInsights(playerIds) : []
    const insightsText = insights
      .map(i => `${i.playerName}: ${i.insight} (${i.games} games)`)
      .join('\n') || 'No recent performance insights available.'

    const rosterSummary = rosterPlayers
      .map(p => `${p.playerId} (${p.position}, age ${p.age ?? '?'})`)
      .join(', ')

    const sectionPrompts: Record<string, { instruction: string; schema: string; maxTokens: number }> = {
      full: {
        instruction: 'Generate a comprehensive 2026-2028 dynasty strategy report. Be brutally honest and actionable.',
        schema: `{
  "archetype": "${teamData.archetype}",
  "archetypeScore": ${teamData.score},
  "archetypeExplanation": "${teamData.explanation}",
  "winWindow": "2026-2027" | "2027-2028" | "2028+" | "Rebuilding",
  "overallStrategy": "2-3 sentence high-level strategy summary",
  "rosterGrade": "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F",
  "buyTargets": [
    { "name": "Player Name", "position": "QB", "reason": "Why to acquire" }
  ],
  "sellTargets": [
    { "name": "Player Name", "position": "RB", "reason": "Why to sell high" }
  ],
  "holdTargets": [
    { "name": "Player Name", "position": "WR", "reason": "Why they are core" }
  ],
  "keyInsights": [
    {
      "category": "roster" | "trade" | "draft" | "waiver",
      "title": "Short title",
      "description": "Detailed explanation",
      "priority": "high" | "medium" | "low",
      "action": "Specific recommended action"
    }
  ],
  "immediateActions": [
    "First thing to do right now",
    "Second priority action"
  ],
  "radarProfile": {
    "qbStrength": 0-100,
    "rbDepth": 0-100,
    "wrYouth": 0-100,
    "tePremiumFit": 0-100,
    "futureCapital": 0-100,
    "contentionWindow": 0-100
  },
  "dynastyTimeline": [
    { "year": "2026", "label": "What to focus on this year", "subtext": "Brief tactical advice", "icon": "trophy" },
    { "year": "2027", "label": "Next year projection and advice", "subtext": "Brief tactical advice", "icon": "shield" },
    { "year": "2028", "label": "Long-term outlook and recommendations", "subtext": "Brief tactical advice", "icon": "refresh" }
  ],
  "weeklyBrief": "A paragraph-length weekly game plan and lineup advice",
  "rosterMoves": "Specific roster construction recommendations, cuts, IR stashes",
  "waiverTargets": "Top waiver wire targets with reasoning for this team archetype",
  "longTermPlan": "3-year dynasty blueprint: what to do in 2026, 2027, 2028"
}`,
        maxTokens: 3000,
      },
      weekly: {
        instruction: "Generate this week's brief: key matchups, start/sit advice, injury notes, and trade windows opening this week. Be specific to players on the roster.",
        schema: `{ "weeklyBrief": "Detailed multi-paragraph weekly game plan with lineup decisions, matchup advantages, injury concerns, and time-sensitive trade windows" }`,
        maxTokens: 1500,
      },
      roster: {
        instruction: 'Suggest 3-5 immediate roster moves (trades, drops, adds) based on team archetype and positional needs. Include specific player names and reasoning.',
        schema: `{ "rosterMoves": "Detailed multi-paragraph roster construction plan with specific moves, IR stash candidates, practice squad targets, and cut candidates with reasoning" }`,
        maxTokens: 1500,
      },
      waiver: {
        instruction: 'Identify top 5-10 waiver wire targets this week, ranked by dynasty value and fit for this specific team archetype. Include FAAB bid suggestions.',
        schema: `{ "waiverTargets": "Ranked list of waiver targets with player names, positions, ownership %, dynasty value reasoning, and recommended FAAB bids for this archetype" }`,
        maxTokens: 1500,
      },
      longterm: {
        instruction: 'Outline the 2026-2028 dynasty plan: rebuild timeline, pick strategy, aging curve management, and key decision points for each year.',
        schema: `{ "longTermPlan": "Comprehensive multi-paragraph 3-year dynasty blueprint covering 2026 priorities, 2027 projections, 2028 outlook, draft capital strategy, aging curve management, and key pivot points" }`,
        maxTokens: 1500,
      },
    }

    const sectionConfig = sectionPrompts[section] || sectionPrompts.full

    const prompt = `You are AllFantasy's elite dynasty fantasy football strategist.

Team Data:
- Archetype: ${teamData.archetype} (Score: ${teamData.score}/100)
- Explanation: ${teamData.explanation}
- Positional Needs: ${teamData.positionalNeeds}
- Future Draft Capital: ${futurePicksCount} picks
- Roster: ${rosterSummary}

Rolling Insights:
${insightsText}

${sectionConfig.instruction}

Output **strict JSON only** with this structure:

${sectionConfig.schema}

Return ONLY valid JSON. No markdown, no explanation outside the JSON object.`

    const result = await openaiChatJson({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: sectionConfig.maxTokens,
    })

    if (!result.ok) {
      console.error('[Strategy Generate] OpenAI error:', result.details)
      return NextResponse.json(
        { error: 'AI strategy generation failed. Please try again.' },
        { status: 502 }
      )
    }

    const rawContent = result.json?.choices?.[0]?.message?.content
    let strategy: any

    try {
      strategy = JSON.parse(rawContent || '{}')
    } catch {
      console.error('[Strategy Generate] Failed to parse AI response:', rawContent)
      return NextResponse.json(
        { error: 'AI returned an invalid response. Please retry.' },
        { status: 502 }
      )
    }

    const sectionTitles: Record<string, string> = {
      full: `${teamData.archetype} — ${strategy.winWindow || 'Dynasty'} Strategy`,
      weekly: `Weekly Brief — ${new Date().toLocaleDateString()}`,
      roster: `Roster Moves — ${teamData.archetype}`,
      waiver: `Waiver Targets — ${teamData.archetype}`,
      longterm: `Long-Term Plan — ${teamData.archetype}`,
    }

    try {
      await prisma.aIStrategyReport.create({
        data: {
          userId,
          leagueId,
          title: sectionTitles[section] || sectionTitles.full,
          content: strategy,
          archetype: teamData.archetype,
          score: teamData.score,
        },
      })
    } catch (e) {
      console.warn('[Strategy Generate] Report save failed (non-critical):', e)
    }

    return NextResponse.json({ success: true, strategy, section })
  } catch (error: any) {
    console.error('[Strategy Generate] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Strategy generation failed' },
      { status: 500 }
    )
  }
}
