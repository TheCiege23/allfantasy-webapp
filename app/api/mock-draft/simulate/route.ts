import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { openaiChatJson } from '@/lib/openai-client'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { leagueId, rounds = 15 } = body

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
      include: {
        teams: {
          select: { id: true, ownerName: true, teamName: true },
          take: 20,
        },
      },
    })

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const numTeams = league.leagueSize || league.teams.length || 12
    const teamNames = league.teams.length > 0
      ? league.teams.map(t => t.teamName || t.ownerName || 'Unknown')
      : Array.from({ length: numTeams }, (_, i) => `Team ${i + 1}`)

    const userTeamIdx = 0

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

Return a JSON object with a "draftResults" array. Each pick must have:
{ "round": number, "pick": number (1-based within round), "overall": number, "playerName": string, "position": string (QB/RB/WR/TE/K/DEF), "team": string (NFL team abbreviation), "manager": string, "confidence": number, "isUser": boolean, "value": number (0-100 dynasty value), "notes": string }

Return ONLY valid JSON, no markdown.`

    const userPrompt = `Simulate a ${rounds}-round snake mock draft for this ${numTeams}-team ${league.isDynasty ? 'dynasty' : 'redraft'} ${league.scoring || 'PPR'} league.

Team names in draft order: ${teamNames.join(', ')}

The user controls "${teamNames[userTeamIdx]}" (pick position #${userTeamIdx + 1}).

Generate all ${rounds * numTeams} picks with realistic player selections based on current ADP data.`

    const result = await openaiChatJson({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      maxTokens: 8000,
    })

    if (!result.ok) {
      console.error('[mock-draft] AI error:', result.details)
      return NextResponse.json({ error: 'AI analysis failed', details: result.details }, { status: 500 })
    }

    const draftResults = result.json?.draftResults
    if (!Array.isArray(draftResults)) {
      console.error('[mock-draft] Invalid response shape:', result.json)
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    return NextResponse.json({ draftResults })
  } catch (err: any) {
    console.error('[mock-draft] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
