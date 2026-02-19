import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI()

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
    for (const mgr of managers) {
      rosters[mgr] = picksThrough
        .filter((p: any) => p.manager === mgr)
        .map((p: any) => ({ position: p.position, player: p.playerName }))
    }

    const leagueFormat = `${league?.scoring || 'PPR'} ${league?.isDynasty ? 'Dynasty' : 'Redraft'}`
    const leagueSize = league?.leagueSize || managers.length
    const totalRounds = Math.max(...draftResults.map((p: any) => p.round))
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
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 }
  r.forEach(p => { if (counts[p.position] !== undefined) counts[p.position]++ })
  return `${mgr}${mgr === userManager ? ' [USER]' : ''}: ${r.map(p => `${p.player} (${p.position})`).join(', ')} | Counts: QB:${counts.QB} RB:${counts.RB} WR:${counts.WR} TE:${counts.TE}`
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

    return NextResponse.json({
      round,
      teams: parsed.teams || [],
      userAdvice: parsed.userAdvice || '',
    })
  } catch (err: any) {
    console.error('[mock-draft/needs] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
