import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' })

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { direction, pickNumber, draftId, leagueFormat } = body

    if (!direction || !['up', 'down'].includes(direction)) {
      return NextResponse.json({ error: 'direction must be "up" or "down"' }, { status: 400 })
    }
    if (!pickNumber || typeof pickNumber !== 'number') {
      return NextResponse.json({ error: 'pickNumber is required' }, { status: 400 })
    }

    let draftResults: any[]
    let userTeam: string

    if (draftId) {
      const draft = await prisma.mockDraft.findFirst({
        where: { id: draftId, userId: session.user.id },
      })
      if (!draft) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }
      draftResults = draft.results as any[]
    } else if (body.draftResults && Array.isArray(body.draftResults)) {
      draftResults = body.draftResults
    } else {
      return NextResponse.json({ error: 'draftId or draftResults required' }, { status: 400 })
    }

    const currentPick = draftResults.find((p: any) => p.overall === pickNumber)
    if (!currentPick) {
      return NextResponse.json({ error: 'Pick not found in draft' }, { status: 400 })
    }
    if (!currentPick.isUser) {
      return NextResponse.json({ error: 'Can only simulate trades on your own picks' }, { status: 400 })
    }

    userTeam = currentPick.manager || body.userTeam || 'User'

    const nearbyPicks = draftResults
      .filter((p: any) => {
        if (direction === 'up') {
          return p.overall < pickNumber && p.overall >= pickNumber - 8 && !p.isUser
        } else {
          return p.overall > pickNumber && p.overall <= pickNumber + 8 && !p.isUser
        }
      })
      .sort((a: any, b: any) => direction === 'up' ? b.overall - a.overall : a.overall - b.overall)

    if (nearbyPicks.length === 0) {
      return NextResponse.json({
        error: `No viable trade partners found ${direction === 'up' ? 'above' : 'below'} pick #${pickNumber}`,
      }, { status: 400 })
    }

    const userPicks = draftResults.filter((p: any) => p.isUser)

    const systemPrompt = `You are an expert fantasy football trade negotiator specializing in draft pick trades during live drafts. You understand pick value charts, positional scarcity, and realistic trade scenarios.

You must return valid JSON with this exact structure:
{
  "tradePackage": {
    "userGives": [{ "type": "pick" | "player", "description": string, "value": number }],
    "userGets": [{ "type": "pick" | "player", "description": string, "value": number }],
    "targetManager": string,
    "targetPick": number
  },
  "analysis": string,
  "fairnessScore": number,
  "likelihood": number,
  "playerTarget": string,
  "alternateScenarios": [{ "description": string, "cost": string }]
}`

    const userPrompt = `The user ("${userTeam}") is currently on the clock at pick #${pickNumber} and wants to trade ${direction === 'up' ? 'UP to get an earlier pick' : 'DOWN to accumulate extra picks/value'}.

Current draft state:
- User's picks so far: ${userPicks.map((p: any) => `#${p.overall} ${p.playerName} (${p.position})`).join(', ') || 'None yet'}
- User's current pick: #${pickNumber}
- League format: ${leagueFormat || 'PPR Redraft'}

${direction === 'up' ? `Available targets to trade UP to:\n${nearbyPicks.map((p: any) => `Pick #${p.overall} - ${p.manager} selected ${p.playerName} (${p.position}, ${p.team})`).join('\n')}` : `Picks ahead that could trade DOWN to user:\n${nearbyPicks.map((p: any) => `Pick #${p.overall} - ${p.manager} would select ${p.playerName} (${p.position}, ${p.team})`).join('\n')}`}

Propose a realistic trade package. Consider:
- Pick value differences (earlier picks are exponentially more valuable)
- What the trading partner would realistically accept
- Whether the trade makes strategic sense for both sides
- Future round picks the user could include as sweetener`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('[trade-sim] Failed to parse:', content.slice(0, 300))
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error('[trade-sim] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
