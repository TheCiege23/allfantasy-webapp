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

    const body = await req.json()
    const { leagueId, currentPick, direction, rounds = 18 } = body

    if (!leagueId || !currentPick || !direction) {
      return NextResponse.json({ error: 'leagueId, currentPick, and direction are required' }, { status: 400 })
    }
    if (!['up', 'down'].includes(direction)) {
      return NextResponse.json({ error: 'direction must be "up" or "down"' }, { status: 400 })
    }

    const draft = await prisma.mockDraft.findFirst({
      where: { leagueId, userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (!draft || !Array.isArray(draft.results)) {
      return NextResponse.json({ error: 'No existing draft found. Run a mock draft first.' }, { status: 404 })
    }

    const draftResults = (draft.results as any[]).map(p => ({ ...p }))
    const userPickIdx = draftResults.findIndex((p: any) => p.overall === currentPick && p.isUser)
    if (userPickIdx === -1) {
      return NextResponse.json({ error: 'That pick is not yours or does not exist' }, { status: 400 })
    }

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
    })

    const candidates = draftResults
      .map((p, idx) => ({ ...p, _idx: idx }))
      .filter((p: any) => {
        if (direction === 'up') {
          return p.overall < currentPick && p.overall >= currentPick - 10 && !p.isUser
        } else {
          return p.overall > currentPick && p.overall <= currentPick + 10 && !p.isUser
        }
      })
      .sort((a: any, b: any) => direction === 'up' ? b.overall - a.overall : a.overall - b.overall)

    if (candidates.length === 0) {
      return NextResponse.json({
        error: `No viable trade partners ${direction === 'up' ? 'above' : 'below'} pick #${currentPick}`,
      }, { status: 400 })
    }

    const tradePartner = candidates[0]
    const partnerIdx = tradePartner._idx
    const userPick = draftResults[userPickIdx]

    const userManager = userPick.manager
    const userAvatar = userPick.managerAvatar || null
    const partnerManager = tradePartner.manager
    const partnerAvatar = tradePartner.managerAvatar || null

    draftResults[userPickIdx] = {
      ...draftResults[userPickIdx],
      manager: partnerManager,
      managerAvatar: partnerAvatar,
      isUser: false,
    }
    draftResults[partnerIdx] = {
      ...draftResults[partnerIdx],
      manager: userManager,
      managerAvatar: userAvatar,
      isUser: true,
    }

    const alreadyDrafted = new Set(
      draftResults
        .filter((_, idx) => idx !== userPickIdx && idx !== partnerIdx)
        .map((p: any) => p.playerName?.toLowerCase())
    )

    let adpContext = ''
    try {
      const adpType = league?.isDynasty ? 'dynasty' : 'redraft'
      const adpEntries = await getLiveADP(adpType as 'dynasty' | 'redraft', 150)
      if (adpEntries.length > 0) {
        const available = adpEntries.filter(e => !alreadyDrafted.has(e.name.toLowerCase()))
        if (available.length > 0) {
          adpContext = `\nAvailable players by ADP:\n${formatADPForPrompt(available, 40)}`
        }
      }
    } catch {}

    const slot1 = draftResults[partnerIdx]
    const slot2 = draftResults[userPickIdx]
    const leagueFormat = `${league?.scoring || 'PPR'} ${league?.isDynasty ? 'Dynasty' : 'Redraft'}`

    const systemPrompt = `You are an expert fantasy football draft advisor. Given two draft slots that need new player selections after a trade, pick the most realistic player for each slot based on ADP data, positional need, and draft position.

Return valid JSON:
{
  "pick1": { "playerName": string, "position": string, "team": string, "confidence": number, "value": number, "notes": string },
  "pick2": { "playerName": string, "position": string, "team": string, "confidence": number, "value": number, "notes": string }
}`

    const userPrompt = `Two picks need new player selections after a trade in a ${leagueFormat} league:

Slot 1: Overall pick #${slot1.overall} (Round ${slot1.round}, Pick ${slot1.pick}) — now drafted by "${slot1.manager}" ${slot1.isUser ? '[USER]' : ''}
Slot 2: Overall pick #${slot2.overall} (Round ${slot2.round}, Pick ${slot2.pick}) — now drafted by "${slot2.manager}" ${slot2.isUser ? '[USER]' : ''}

Previously at these slots: ${tradePartner.playerName} (${tradePartner.position}) and ${userPick.playerName} (${userPick.position})

Players already drafted (DO NOT pick these): ${Array.from(alreadyDrafted).slice(0, 80).join(', ')}
${adpContext}

Pick realistic players for each slot based on their draft position (ADP). The earlier pick should get a better player. Confidence range 60-95.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 800,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('[trade-simulate] Failed to parse:', content.slice(0, 300))
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    if (parsed.pick1) {
      draftResults[partnerIdx] = {
        ...draftResults[partnerIdx],
        playerName: parsed.pick1.playerName || draftResults[partnerIdx].playerName,
        position: parsed.pick1.position || draftResults[partnerIdx].position,
        team: parsed.pick1.team || draftResults[partnerIdx].team,
        confidence: parsed.pick1.confidence || 75,
        value: parsed.pick1.value || draftResults[partnerIdx].value,
        notes: parsed.pick1.notes || '',
      }
    }
    if (parsed.pick2) {
      draftResults[userPickIdx] = {
        ...draftResults[userPickIdx],
        playerName: parsed.pick2.playerName || draftResults[userPickIdx].playerName,
        position: parsed.pick2.position || draftResults[userPickIdx].position,
        team: parsed.pick2.team || draftResults[userPickIdx].team,
        confidence: parsed.pick2.confidence || 75,
        value: parsed.pick2.value || draftResults[userPickIdx].value,
        notes: parsed.pick2.notes || '',
      }
    }

    const uniqueOveralls = new Set(draftResults.map((p: any) => p.overall))
    if (uniqueOveralls.size !== draftResults.length) {
      console.error('[trade-simulate] Duplicate overalls detected after swap')
      return NextResponse.json({ error: 'Draft integrity error' }, { status: 500 })
    }

    try {
      await prisma.mockDraft.update({
        where: { id: draft.id },
        data: { results: draftResults },
      })
    } catch (saveErr) {
      console.error('[trade-simulate] Failed to save:', saveErr)
    }

    const userNewPick = direction === 'up' ? tradePartner.overall : tradePartner.overall
    const partnerNewPick = currentPick

    return NextResponse.json({
      updatedDraft: draftResults,
      tradeDescription: `${userManager} traded pick #${currentPick} to ${partnerManager} for pick #${tradePartner.overall}. Both slots have been re-drafted with new player selections.`,
      tradedPicks: {
        userNewPick: tradePartner.overall,
        partnerNewPick: currentPick,
        partnerManager,
      },
    })
  } catch (err: any) {
    console.error('[trade-simulate] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
