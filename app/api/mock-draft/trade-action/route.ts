import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { getLiveADP, formatADPForPrompt } from '@/lib/adp-data'

const openai = new OpenAI()

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leagueId, pickNumber, action } = await req.json()

    if (!leagueId || !pickNumber || !action) {
      return NextResponse.json({ error: 'leagueId, pickNumber, and action are required' }, { status: 400 })
    }
    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "accept" or "reject"' }, { status: 400 })
    }

    const mock = await prisma.mockDraft.findFirst({
      where: { leagueId, userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (!mock || !Array.isArray(mock.results)) {
      return NextResponse.json({ error: 'No draft found' }, { status: 404 })
    }

    const storedProposals = (mock.proposals as any[]) || []
    const proposal = storedProposals.find((p: any) => p.pickOverall === pickNumber)

    if (!proposal) {
      return NextResponse.json({ error: `No trade proposal found for pick #${pickNumber}` }, { status: 404 })
    }

    let updatedResults = mock.results as any[]

    if (action === 'reject') {
      const remainingProposals = storedProposals.filter((p: any) => p.pickOverall !== pickNumber)
      await prisma.mockDraft.update({
        where: { id: mock.id },
        data: { proposals: remainingProposals },
      })

      return NextResponse.json({ updatedDraft: updatedResults })
    }

    const originalDraft = (updatedResults as any[]).map(p => ({ ...p }))
    const userPick = originalDraft.find((p: any) => p.overall === pickNumber && p.isUser)
    if (!userPick) {
      return NextResponse.json({ error: 'That pick is not yours' }, { status: 400 })
    }

    const tradePartnerPick = proposal.fromPick
    const partnerPick = originalDraft.find((p: any) => p.overall === tradePartnerPick && !p.isUser)
    if (!partnerPick) {
      return NextResponse.json({ error: `Pick #${tradePartnerPick} is no longer valid` }, { status: 400 })
    }

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
    })

    const userManager = userPick.manager
    const partnerManager = partnerPick.manager
    const tradePoint = Math.min(pickNumber, tradePartnerPick)

    const lockedPicks = originalDraft.filter((p: any) => p.overall < tradePoint)
    const picksToRedraft = originalDraft
      .filter((p: any) => p.overall >= tradePoint)
      .map(p => ({ ...p }))

    for (const p of picksToRedraft) {
      if (p.overall === pickNumber) {
        p.manager = partnerManager
        p.managerAvatar = partnerPick.managerAvatar || null
        p.isUser = false
      } else if (p.overall === tradePartnerPick) {
        p.manager = userManager
        p.managerAvatar = userPick.managerAvatar || null
        p.isUser = true
      }
    }

    const lockedPlayerNames = new Set(
      lockedPicks.map((p: any) => p.playerName?.toLowerCase()).filter(Boolean)
    )

    let adpContext = ''
    let adpFallbackPool: { name: string; position?: string; team?: string }[] = []
    try {
      const adpType = league?.isDynasty ? 'dynasty' : 'redraft'
      const adpEntries = await getLiveADP(adpType as 'dynasty' | 'redraft', 300)
      adpFallbackPool = adpEntries.map(e => ({ name: e.name, position: e.position, team: e.team }))
      const available = adpEntries.filter(e => !lockedPlayerNames.has(e.name.toLowerCase()))
      if (available.length > 0) {
        adpContext = `\nAvailable players by ADP:\n${formatADPForPrompt(available, 60)}`
      }
    } catch {}

    const leagueFormat = `${league?.scoring || 'PPR'} ${league?.isDynasty ? 'Dynasty' : 'Redraft'}`
    const direction = proposal.direction

    const slotsToFill = picksToRedraft.map(p =>
      `#${p.overall} R${p.round}P${p.pick} — ${p.manager}${p.isUser ? ' [USER]' : ''}`
    ).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert fantasy football draft simulator. After a draft-day trade, re-run all picks from the trade point forward with realistic ADP-based selections.

Return valid JSON:
{
  "picks": [
    { "overall": number, "playerName": string, "position": string, "team": string, "confidence": number, "value": number, "notes": string }
  ]
}

Rules:
- One entry per slot, matching overall numbers provided
- Use ADP data — earlier picks get better players
- No duplicate players, no players already locked before the trade
- [USER] manager gets realistic best-available picks
- Confidence range: 60-95`,
        },
        {
          role: 'user',
          content: `Trade accepted in a ${leagueFormat} mock draft:
"${userManager}" traded pick #${pickNumber} to "${partnerManager}" for pick #${tradePartnerPick}.
${direction === 'up' ? `${userManager} moved UP for an earlier pick.` : `${userManager} moved DOWN, gaining value.`}

Locked players (before pick #${tradePoint}, DO NOT reuse):
${Array.from(lockedPlayerNames).join(', ') || 'None'}

Re-simulate these ${picksToRedraft.length} slots from pick #${tradePoint} onward:
${slotsToFill}
${adpContext}

Return exactly ${picksToRedraft.length} picks.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 16000,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('[trade-action] Failed to parse:', content.slice(0, 500))
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const aiPicks: any[] = parsed?.picks || []
    const aiPickMap = new Map<number, any>()
    for (const ap of aiPicks) {
      if (ap.overall) aiPickMap.set(ap.overall, ap)
    }

    const usedPlayers = new Set(lockedPlayerNames)

    for (const slot of picksToRedraft) {
      const aiPick = aiPickMap.get(slot.overall)
      if (aiPick?.playerName && !usedPlayers.has(aiPick.playerName.toLowerCase())) {
        slot.playerName = aiPick.playerName
        slot.position = aiPick.position || slot.position
        slot.team = aiPick.team || slot.team
        slot.confidence = aiPick.confidence || 75
        slot.value = aiPick.value || slot.value
        slot.notes = aiPick.notes || ''
        usedPlayers.add(aiPick.playerName.toLowerCase())
      } else {
        const fallback = adpFallbackPool.find(f => !usedPlayers.has(f.name.toLowerCase()))
        if (fallback) {
          slot.playerName = fallback.name
          slot.position = fallback.position || slot.position
          slot.team = fallback.team || slot.team
          slot.confidence = 65
          slot.value = slot.value || 50
          slot.notes = 'ADP fallback selection'
          usedPlayers.add(fallback.name.toLowerCase())
        } else {
          usedPlayers.add(slot.playerName?.toLowerCase() || '')
        }
      }
    }

    updatedResults = [...lockedPicks, ...picksToRedraft].sort((a, b) => a.overall - b.overall)

    const seen = new Set<string>()
    for (const slot of updatedResults) {
      const key = slot.playerName?.toLowerCase()
      if (key && seen.has(key)) {
        const fallback = adpFallbackPool.find(
          f => !seen.has(f.name.toLowerCase()) && !lockedPlayerNames.has(f.name.toLowerCase())
        )
        if (fallback) {
          slot.playerName = fallback.name
          slot.position = fallback.position || slot.position
          slot.team = fallback.team || slot.team
          slot.notes = 'Dedup fallback'
        }
      }
      if (slot.playerName) seen.add(slot.playerName.toLowerCase())
    }

    if (updatedResults.length !== originalDraft.length) {
      console.error('[trade-action] Length mismatch:', updatedResults.length, 'vs', originalDraft.length)
      return NextResponse.json({ error: 'Draft integrity error' }, { status: 500 })
    }

    const newDraft = await prisma.mockDraft.create({
      data: {
        leagueId,
        userId: session.user.id,
        rounds: mock.rounds,
        results: updatedResults,
        proposals: [],
      },
    })

    return NextResponse.json({ updatedDraft: updatedResults, draftId: newDraft.id })
  } catch (err: any) {
    console.error('[trade-action] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
