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

    const body = await req.json()
    const { leagueId, rounds = 15, refresh = false } = body

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
      include: {
        teams: {
          select: { id: true, ownerName: true, teamName: true, avatarUrl: true },
          take: 20,
        },
        rosters: {
          select: { platformUserId: true, playerData: true },
          take: 20,
        },
      },
    })

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    if (!refresh) {
      const existing = await prisma.mockDraft.findFirst({
        where: { leagueId, userId: session.user.id },
        orderBy: { createdAt: 'desc' },
      })
      if (existing) {
        const age = Date.now() - existing.createdAt.getTime()
        if (age < 1000 * 60 * 60) {
          return NextResponse.json({ draftResults: existing.results })
        }
      }
    }

    const numTeams = league.leagueSize || league.teams.length || 12
    const teamNames = league.teams.length > 0
      ? league.teams.map(t => t.teamName || t.ownerName || 'Unknown')
      : Array.from({ length: numTeams }, (_, i) => `Team ${i + 1}`)

    let draftOrderContext = ''
    try {
      const draftOrderCache = await prisma.sportsDataCache.findFirst({
        where: { key: `draft-order-${league.platformLeagueId}` },
      })
      if (draftOrderCache?.data && typeof draftOrderCache.data === 'object') {
        const orderMap = draftOrderCache.data as Record<string, number>
        const entries = Object.entries(orderMap).sort(([, a], [, b]) => a - b)
        if (entries.length > 0) {
          draftOrderContext = `\n\nReal draft order from Sleeper (roster_id → slot): ${entries.map(([rid, slot]) => `${rid}→#${slot}`).join(', ')}`
        }
      }
    } catch {}

    const userTeamIdx = 0

    let rosterContext = ''
    if (league.rosters.length > 0) {
      const summaries = league.rosters.slice(0, numTeams).map((r, i) => {
        const data = r.playerData as any
        if (Array.isArray(data)) {
          return `${teamNames[i] || `Team ${i + 1}`}: ${data.length} players`
        }
        return `${teamNames[i] || `Team ${i + 1}`}: roster data available`
      })
      rosterContext = `\n\nCurrent rosters and needs:\n${summaries.join('\n')}`
    }

    const systemPrompt = `You are an expert fantasy football mock draft simulator. You simulate realistic drafts based on current ADP (Average Draft Position) data, positional scarcity, and real manager draft tendencies.

Rules:
- Generate a full ${rounds}-round mock draft for a ${numTeams}-team league
- Use snake draft order (odd rounds ascending, even rounds descending)
- Base picks on realistic ADP values and positional needs
- Each AI manager should have a distinct draft style (some reach, some go BPA, some are position-focused)
- Team at index ${userTeamIdx} ("${teamNames[userTeamIdx]}") is the user's team — mark those picks with isUser: true
- League format: ${league.scoring || 'PPR'}, ${league.isDynasty ? 'Dynasty' : 'Redraft'}
- Include real NFL player names with correct positions and teams
- Confidence represents how strongly the AI recommends that pick (60-95 range)
- Notes should be a brief scouting blurb

Return a JSON object with a "draftResults" array. Each pick object:
{ "round": number, "pick": number, "overall": number, "playerName": string, "position": string, "team": string, "manager": string, "confidence": number, "isUser": boolean, "value": number, "notes": string }`

    const userPrompt = `Simulate a ${rounds}-round snake mock draft for this ${numTeams}-team ${league.isDynasty ? 'dynasty' : 'redraft'} ${league.scoring || 'PPR'} league.

Team names in draft order: ${teamNames.join(', ')}

The user controls "${teamNames[userTeamIdx]}" (pick position #${userTeamIdx + 1}).${draftOrderContext}${rosterContext}

Generate all ${rounds * numTeams} picks with realistic player selections based on current ADP data.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 8000,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('[mock-draft] Failed to parse AI response:', content.slice(0, 500))
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    const draftResults = parsed?.draftResults || parsed?.draft_results || (Array.isArray(parsed) ? parsed : null)
    if (!Array.isArray(draftResults)) {
      console.error('[mock-draft] Unexpected response shape:', Object.keys(parsed))
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    const avatarMap: Record<string, string> = {}
    for (const t of league.teams) {
      const name = t.teamName || t.ownerName || ''
      if (name && t.avatarUrl) avatarMap[name.toLowerCase()] = t.avatarUrl
    }
    for (const pick of draftResults) {
      if (pick.manager) {
        pick.managerAvatar = avatarMap[pick.manager.toLowerCase()] || null
      }
    }

    try {
      await prisma.mockDraft.create({
        data: {
          leagueId,
          userId: session.user.id,
          rounds,
          results: draftResults,
        },
      })
    } catch (saveErr) {
      console.error('[mock-draft] Failed to save draft:', saveErr)
    }

    return NextResponse.json({ draftResults })
  } catch (err: any) {
    console.error('[mock-draft] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
