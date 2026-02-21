import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL })

const POSITION_TARGETS: Record<string, { starter: number; ideal: number }> = {
  QB: { starter: 1, ideal: 2 },
  RB: { starter: 2, ideal: 4 },
  WR: { starter: 2, ideal: 4 },
  TE: { starter: 1, ideal: 2 },
  K: { starter: 1, ideal: 1 },
  DEF: { starter: 1, ideal: 1 },
}

function calculateNeedLevel(
  counts: Record<string, number>,
  round: number,
  totalRounds: number,
  isDynasty: boolean
): { score: number; topNeed: string | null; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {}
  let maxNeed = 0
  let topNeed: string | null = null

  for (const [pos, targets] of Object.entries(POSITION_TARGETS)) {
    const count = counts[pos] || 0
    let need = 0

    if (count < targets.starter) {
      const deficit = targets.starter - count
      need = 70 + deficit * 15

      const earlyWindow = pos === 'QB' || pos === 'TE'
        ? totalRounds * 0.4
        : totalRounds * 0.5
      if (round < earlyWindow) {
        need += 10
      }
    } else if (count < targets.ideal) {
      const deficit = targets.ideal - count
      need = 30 + deficit * 15

      const remainingRounds = totalRounds - round
      if (remainingRounds <= 3 && deficit > 1) {
        need += 10
      }
    } else {
      need = 5
    }

    if (isDynasty && (pos === 'QB' || pos === 'RB') && count < targets.ideal) {
      need += 5
    }

    need = Math.min(100, Math.max(0, need))
    breakdown[pos] = need

    if (need > maxNeed) {
      maxNeed = need
      topNeed = pos
    }
  }

  const score = Math.round(
    Object.values(breakdown).reduce((sum, v) => sum + v, 0) / Object.keys(breakdown).length
  )

  return { score, topNeed, breakdown }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leagueId, round, draftResults: clientDraft } = await req.json()

    if (!leagueId || !round) {
      return NextResponse.json({ error: 'leagueId and round are required' }, { status: 400 })
    }

    let draftResults: any[] = clientDraft
    if (!draftResults || !Array.isArray(draftResults) || draftResults.length === 0) {
      const draft = await prisma.mockDraft.findFirst({
        where: { leagueId, userId: session.user.id },
        orderBy: { createdAt: 'desc' },
      })
      if (!draft || !Array.isArray(draft.results)) {
        return NextResponse.json({ error: 'No draft found' }, { status: 404 })
      }
      draftResults = draft.results as any[]
    }

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
    })

    const picksThrough = draftResults.filter((p: any) => p.round <= round)
    const managers = Array.from(new Set(draftResults.map((p: any) => p.manager)))

    const rosters: Record<string, { position: string; player: string }[]> = {}
    const rosterCounts: Record<string, Record<string, number>> = {}
    for (const mgr of managers) {
      rosters[mgr] = picksThrough
        .filter((p: any) => p.manager === mgr)
        .map((p: any) => ({ position: p.position, player: p.playerName }))
      const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 }
      rosters[mgr].forEach(p => { if (counts[p.position] !== undefined) counts[p.position]++ })
      rosterCounts[mgr] = counts
    }

    const leagueFormat = `${league?.scoring || 'PPR'} ${league?.isDynasty ? 'Dynasty' : 'Redraft'}`
    const leagueSize = league?.leagueSize || managers.length
    const totalRounds = Math.max(...draftResults.map((p: any) => p.round))
    const isDynasty = !!league?.isDynasty

    const needLevels: Record<string, ReturnType<typeof calculateNeedLevel>> = {}
    for (const mgr of managers) {
      needLevels[mgr] = calculateNeedLevel(rosterCounts[mgr], round, totalRounds, isDynasty)
    }
    const remainingRounds = totalRounds - round

    const userManager = draftResults.find((p: any) => p.isUser)?.manager || 'User'

    const systemPrompt = `You are an expert fantasy football draft analyst. Analyze each team's roster after a given round and identify their positional needs, strategic priorities, and likely draft targets for upcoming rounds.

Return valid JSON:
{
  "teams": [
    {
      "manager": string,
      "isUser": boolean,
      "roster": { "QB": number, "RB": number, "WR": number, "TE": number, "K": number, "DEF": number },
      "needs": [{ "position": string, "urgency": "critical" | "high" | "moderate" | "low", "reason": string }],
      "likelyTargets": [string],
      "strategy": string
    }
  ],
  "userAdvice": string
}`

    const userPrompt = `Analyze team needs after Round ${round} of ${totalRounds} in a ${leagueSize}-team ${leagueFormat} league.

Current rosters through Round ${round}:
${managers.map(mgr => {
  const r = rosters[mgr]
  const c = rosterCounts[mgr]
  const nl = needLevels[mgr]
  return `${mgr}${mgr === userManager ? ' [USER]' : ''}: ${r.map(p => `${p.player} (${p.position})`).join(', ')} | Counts: QB:${c.QB} RB:${c.RB} WR:${c.WR} TE:${c.TE} | Need Score: ${nl.score}/100 (Top Need: ${nl.topNeed || 'None'})`
}).join('\n')}

${remainingRounds} rounds remain. Consider:
- Standard roster requirements (1 QB, 2 RB, 2-3 WR, 1 TE minimum starters)
- ${league?.isDynasty ? 'Dynasty value and youth' : 'Win-now redraft value'}
- Positional scarcity relative to draft position
- Which teams are competitors for the same positions
- Strategic advice for the user's team specifically

Return needs analysis for ALL ${managers.length} teams.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 4000,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('[mock-draft/needs] Failed to parse:', content.slice(0, 300))
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const aiTeams = parsed.teams || []
    for (const team of aiTeams) {
      const nl = needLevels[team.manager]
      if (nl) {
        team.needLevel = nl.score
        team.topNeed = nl.topNeed
        team.needBreakdown = nl.breakdown
      }
    }

    for (const mgr of managers) {
      if (!aiTeams.find((t: any) => t.manager === mgr)) {
        const nl = needLevels[mgr]
        const c = rosterCounts[mgr]
        aiTeams.push({
          manager: mgr,
          isUser: mgr === userManager,
          roster: c,
          needs: [],
          likelyTargets: [],
          strategy: '',
          needLevel: nl.score,
          topNeed: nl.topNeed,
          needBreakdown: nl.breakdown,
        })
      }
    }

    return NextResponse.json({
      round,
      teams: aiTeams,
      userAdvice: parsed.userAdvice || '',
    })
  } catch (err: any) {
    console.error('[mock-draft/needs] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
