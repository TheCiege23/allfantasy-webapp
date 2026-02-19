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
    const { leagueId, pickNumber, action } = body

    if (!leagueId || !pickNumber || !action) {
      return NextResponse.json({ error: 'leagueId, pickNumber, and action are required' }, { status: 400 })
    }
    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "accept" or "reject"' }, { status: 400 })
    }

    const draft = await prisma.mockDraft.findFirst({
      where: { leagueId, userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (!draft || !Array.isArray(draft.results)) {
      return NextResponse.json({ error: 'No prior mock draft found. Run a mock draft first.' }, { status: 404 })
    }

    const storedProposals = (draft.proposals as any[]) || []
    const proposal = storedProposals.find((p: any) => p.pickOverall === pickNumber)

    if (!proposal) {
      return NextResponse.json({ error: `No trade proposal found for pick #${pickNumber}` }, { status: 404 })
    }

    if (action === 'reject') {
      const remainingProposals = storedProposals.filter((p: any) => p.pickOverall !== pickNumber)
      await prisma.mockDraft.update({
        where: { id: draft.id },
        data: { proposals: remainingProposals.length > 0 ? remainingProposals : [] },
      })

      return NextResponse.json({
        updatedDraft: draft.results,
        action: 'reject',
        message: `Trade proposal for pick #${pickNumber} rejected.`,
      })
    }

    const originalDraft = (draft.results as any[]).map(p => ({ ...p }))
    const userPickIdx = originalDraft.findIndex((p: any) => p.overall === pickNumber && p.isUser)
    if (userPickIdx === -1) {
      return NextResponse.json({ error: 'That pick is not yours or does not exist' }, { status: 400 })
    }

    const tradePartnerPick = proposal.fromPick
    const explicit = originalDraft.find((p: any) => p.overall === tradePartnerPick && !p.isUser)
    if (!explicit) {
      return NextResponse.json({ error: `Pick #${tradePartnerPick} is no longer a valid trade partner` }, { status: 400 })
    }

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
    })

    const userPick = originalDraft[userPickIdx]
    const userManager = userPick.manager
    const userAvatar = userPick.managerAvatar || null
    const partnerManager = explicit.manager
    const partnerAvatar = explicit.managerAvatar || null

    const tradePoint = Math.min(userPick.overall, explicit.overall)
    const lockedPicks = originalDraft.filter((p: any) => p.overall < tradePoint)
    const picksToRedraft = originalDraft
      .filter((p: any) => p.overall >= tradePoint)
      .map(p => ({ ...p }))

    for (const p of picksToRedraft) {
      if (p.overall === pickNumber) {
        p.manager = partnerManager
        p.managerAvatar = partnerAvatar
        p.isUser = false
      } else if (p.overall === tradePartnerPick) {
        p.manager = userManager
        p.managerAvatar = userAvatar
        p.isUser = true
      }
    }

    const lockedPlayerNames = new Set(lockedPicks.map((p: any) => p.playerName?.toLowerCase()).filter(Boolean))

    let adpContext = ''
    try {
      const adpType = league?.isDynasty ? 'dynasty' : 'redraft'
      const adpEntries = await getLiveADP(adpType as 'dynasty' | 'redraft', 200)
      if (adpEntries.length > 0) {
        const available = adpEntries.filter(e => !lockedPlayerNames.has(e.name.toLowerCase()))
        if (available.length > 0) {
          adpContext = `\nAvailable players by ADP (use this for realistic picks):\n${formatADPForPrompt(available, 60)}`
        }
      }
    } catch {}

    const leagueFormat = `${league?.scoring || 'PPR'} ${league?.isDynasty ? 'Dynasty' : 'Redraft'}`
    const direction = proposal.direction

    const slotsToFill = picksToRedraft.map(p =>
      `#${p.overall} R${p.round}P${p.pick} — ${p.manager}${p.isUser ? ' [USER]' : ''}`
    ).join('\n')

    const systemPrompt = `You are an expert fantasy football draft simulator. After a draft-day trade, you must re-run all picks from the trade point forward with realistic player selections based on ADP data, team needs, and draft position.

Return valid JSON with this exact structure:
{
  "picks": [
    { "overall": number, "playerName": string, "position": string, "team": string, "confidence": number, "value": number, "notes": string }
  ]
}

Rules:
- Return one entry per slot in the "picks" array, matching the overall numbers provided
- Use ADP data to ground selections — earlier picks get better players
- No duplicate players — each player can only be drafted once
- Do NOT include any player already locked in before the trade
- The [USER] manager should get realistic best-available picks at their draft slots
- Confidence range: 60-95`

    const userPrompt = `A trade just happened in a ${leagueFormat} mock draft:
"${userManager}" traded pick #${pickNumber} to "${partnerManager}" for pick #${tradePartnerPick}.
${direction === 'up' ? `${userManager} moved UP to get an earlier pick.` : `${userManager} moved DOWN, gaining value from a later pick position.`}

Players already locked (drafted before pick #${tradePoint}, DO NOT reuse):
${Array.from(lockedPlayerNames).join(', ') || 'None'}

Re-draft these ${picksToRedraft.length} slots from pick #${tradePoint} forward:
${slotsToFill}
${adpContext}

Return a "picks" array with exactly ${picksToRedraft.length} entries, one per slot above, using realistic ADP-based selections.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
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

    let adpFallbackPool: { name: string; position?: string; team?: string }[] = []
    try {
      const adpType = league?.isDynasty ? 'dynasty' : 'redraft'
      const fallbackEntries = await getLiveADP(adpType as 'dynasty' | 'redraft', 300)
      adpFallbackPool = fallbackEntries.map(e => ({ name: e.name, position: e.position, team: e.team }))
    } catch {}

    const usedPlayers = new Set(lockedPlayerNames)

    for (const slot of picksToRedraft) {
      const aiPick = aiPickMap.get(slot.overall)
      if (aiPick && aiPick.playerName && !usedPlayers.has(aiPick.playerName.toLowerCase())) {
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

    const updatedDraft = [...lockedPicks, ...picksToRedraft]
    updatedDraft.sort((a, b) => a.overall - b.overall)

    const allPlayerNames = updatedDraft.map((p: any) => p.playerName?.toLowerCase()).filter(Boolean)
    const uniquePlayers = new Set(allPlayerNames)
    if (uniquePlayers.size < allPlayerNames.length) {
      const seen = new Set<string>()
      for (const slot of updatedDraft) {
        const key = slot.playerName?.toLowerCase()
        if (key && seen.has(key)) {
          const fallback = adpFallbackPool.find(f => !seen.has(f.name.toLowerCase()) && !lockedPlayerNames.has(f.name.toLowerCase()))
          if (fallback) {
            slot.playerName = fallback.name
            slot.position = fallback.position || slot.position
            slot.team = fallback.team || slot.team
            slot.notes = 'Dedup fallback'
          }
        }
        if (slot.playerName) seen.add(slot.playerName.toLowerCase())
      }
    }

    const uniqueOveralls = new Set(updatedDraft.map((p: any) => p.overall))
    if (uniqueOveralls.size !== updatedDraft.length) {
      console.error('[trade-action] Duplicate overalls detected')
      return NextResponse.json({ error: 'Draft integrity error' }, { status: 500 })
    }
    if (updatedDraft.length !== originalDraft.length) {
      console.error('[trade-action] Length mismatch:', updatedDraft.length, 'vs', originalDraft.length)
      return NextResponse.json({ error: 'Draft integrity error' }, { status: 500 })
    }

    try {
      await prisma.mockDraft.update({
        where: { id: draft.id },
        data: {
          results: updatedDraft,
          proposals: [],
        },
      })
    } catch (saveErr) {
      console.error('[trade-action] Failed to save:', saveErr)
    }

    return NextResponse.json({
      updatedDraft,
      action: 'accept',
      tradeDescription: `${userManager} traded pick #${pickNumber} to ${partnerManager} for pick #${tradePartnerPick}. All picks from #${tradePoint} onward have been re-simulated.`,
      tradedPicks: {
        userNewPick: tradePartnerPick,
        partnerNewPick: pickNumber,
        partnerManager,
      },
    })
  } catch (err: any) {
    console.error('[trade-action] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
