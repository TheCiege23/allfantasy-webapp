import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { getLiveADP } from '@/lib/adp-data'
import { applyRealtimeAdpAdjustments } from '@/lib/mock-draft/adp-realtime-adjuster'
import { summarizeDraftValidation, type DraftType } from '@/lib/mock-draft/draft-engine'

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' })

const POSITION_TARGETS: Record<string, { starter: number; ideal: number }> = {
  QB: { starter: 1, ideal: 2 },
  RB: { starter: 2, ideal: 4 },
  WR: { starter: 2, ideal: 4 },
  TE: { starter: 1, ideal: 2 },
}

function getTeamNeeds(
  picks: any[],
  manager: string,
  throughRound: number
): { score: number; topNeed: string | null } {
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 }
  for (const p of picks) {
    if (p.manager === manager && p.round <= throughRound && counts[p.position] !== undefined) {
      counts[p.position]++
    }
  }

  let maxNeed = 0
  let topNeed: string | null = null
  let totalNeed = 0

  for (const [pos, targets] of Object.entries(POSITION_TARGETS)) {
    const count = counts[pos] || 0
    let need = 0
    if (count < targets.starter) {
      need = 70 + (targets.starter - count) * 15
    } else if (count < targets.ideal) {
      need = 30 + (targets.ideal - count) * 10
    }
    totalNeed += need
    if (need > maxNeed) {
      maxNeed = need
      topNeed = pos
    }
  }

  return { score: Math.round(totalNeed / 4), topNeed }
}

function generateInlineTradeProposals(draftResults: any[], league: any): any[] {
  const userManager = draftResults.find((p: any) => p.isUser)?.manager
  if (!userManager) return []

  const totalRounds = Math.max(...draftResults.map((p: any) => p.round))
  const userPicks = draftResults.filter((p: any) => p.isUser)
  const proposals: any[] = []

  for (const userPick of userPicks) {
    if (userPick.round > totalRounds - 2) continue

    const nearbyPicks = draftResults.filter((p: any) =>
      !p.isUser &&
      Math.abs(p.overall - userPick.overall) <= 8 &&
      Math.abs(p.overall - userPick.overall) >= 2
    )

    for (const candidatePick of nearbyPicks) {
      const otherNeeds = getTeamNeeds(draftResults, candidatePick.manager, userPick.round)
      if (otherNeeds.score < 40) continue

      const userNeeds = getTeamNeeds(draftResults, userManager, userPick.round)
      const playerAtUserPick = userPick.playerName
      const playerAtOtherPick = candidatePick.playerName

      const isUpTrade = candidatePick.overall < userPick.overall
      const pickDiff = Math.abs(candidatePick.overall - userPick.overall)

      if (isUpTrade && otherNeeds.score < 50) continue
      if (!isUpTrade && pickDiff < 3) continue

      proposals.push({
        pickOverall: userPick.overall,
        fromTeam: candidatePick.manager,
        fromPick: candidatePick.overall,
        direction: isUpTrade ? 'up' : 'down',
        theyGive: `Pick #${candidatePick.overall} (${playerAtOtherPick}, ${candidatePick.position})`,
        youGive: `Pick #${userPick.overall} (${playerAtUserPick}, ${userPick.position})`,
        theirNeedScore: otherNeeds.score,
        theirTopNeed: otherNeeds.topNeed,
        yourNeedScore: userNeeds.score,
        reason: '',
      })

      if (proposals.filter(p => p.pickOverall === userPick.overall).length >= 1) break
    }
  }

  return proposals
    .sort((a, b) => b.theirNeedScore - a.theirNeedScore)
    .slice(0, 5)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { leagueId, rounds = 15, refresh = false, scoringTweak = 'default', draftType = 'snake', casualMode = false, autopickMode = 'queue-first' } = body

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
          return NextResponse.json({
            draftResults: existing.results,
            draftId: existing.id,
            proposals: (existing.proposals as any[]) || [],
          })
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

    let adpContext = ''
    try {
      const adpType = league.isDynasty ? 'dynasty' : 'redraft'
      const rawADP = await getLiveADP(adpType as 'dynasty' | 'redraft', 200)
      const adjusted = await applyRealtimeAdpAdjustments(rawADP, { isDynasty: league.isDynasty })
      const liveADP = adjusted.entries
      if (liveADP.length > 0) {
        const adpSummary = liveADP.slice(0, 200).map(p =>
          `${p.name} (${p.position}, ${p.team || 'FA'}) - ADP: ${p.adp?.toFixed(1) || 'N/A'} • Value: ${p.value?.toFixed(0) || 'N/A'}`
        ).join('\n')

        const adjustmentNotes = adjusted.adjustments.slice(0, 15).map(a =>
          `${a.name}: ${a.delta > 0 ? '+' : ''}${a.delta.toFixed(1)} ADP (${a.reasons.join(', ')})`
        ).join('\n')

        adpContext = `\n\n=== REAL-TIME ADP & DYNASTY VALUE DATA (${liveADP.length} players, adjusted for news/injuries) ===
Use this real-time ADP and dynasty value data to guide picks. Players MUST be drafted in realistic ADP order with slight variance for team needs and individual draft style. Do NOT invent players — only draft players from this list or well-known NFL starters.

${adpSummary}

=== RECENT ADP ADJUSTMENTS (injuries, news, momentum) ===
${adjustmentNotes || 'No significant adjustments'}`
      }
    } catch (adpErr) {
      console.log('[mock-draft] ADP fetch failed, AI will use internal knowledge:', adpErr)
    }

    const draftTypeLabel = (['snake', 'linear', 'auction'].includes(draftType) ? draftType : 'snake') as DraftType

    const draftFormatInstruction = draftTypeLabel === 'snake'
      ? 'Use snake draft order (odd rounds ascending, even rounds descending).'
      : draftTypeLabel === 'linear'
        ? 'Use linear draft order (same order every round).'
        : 'Use auction nomination + bidding loops and output final winning nominations in sequence.'
    const auctionOutputHint = draftTypeLabel === 'auction'
      ? ' For auction, include realistic values and sequence by winning nomination events.'
      : ''

    const systemPrompt = `You are an expert fantasy football mock draft simulator. You simulate realistic drafts based on current ADP (Average Draft Position) data, positional scarcity, and real manager draft tendencies.

Rules:
- Generate a full ${rounds}-round mock draft for a ${numTeams}-team league
- Draft format: ${draftTypeLabel}. ${draftFormatInstruction}
- Base picks on the LIVE ADP DATA provided below — players should be drafted close to their ADP with realistic variance
- Each AI manager should have a distinct draft style (some reach, some go BPA, some are position-focused)
- Autopick mode default per team: ${autopickMode} (queue-first -> BPA -> need-based fallback)
- Team at index ${userTeamIdx} ("${teamNames[userTeamIdx]}") is the user's team — mark those picks with isUser: true
- League format: ${league.scoring || 'PPR'}, ${league.isDynasty ? 'Dynasty' : 'Redraft'}${scoringTweak === 'sf' ? '\n- SUPERFLEX LEAGUE: QBs are significantly more valuable. Draft QBs earlier and expect 2-3 QBs taken in Round 1. Value QBs like top-10 overall picks.' : ''}${scoringTweak === 'tep' ? '\n- TE PREMIUM LEAGUE: TEs receive bonus PPR scoring (1.5-2.0 PPR). Draft elite TEs earlier (Rounds 1-3 for top TEs). TEs like Kelce, LaPorta, Bowers are valued much higher.' : ''}
- Include real NFL player names with correct positions and teams
- Confidence represents how strongly the AI recommends that pick (60-95 range)
- Notes should be a brief scouting blurb
- The "value" field should reflect the player's dynasty/trade value (higher = more valuable, scale 1-100)

Return a JSON object with a "draftResults" array. Each pick object:
{ "round": number, "pick": number, "overall": number, "playerName": string, "position": string, "team": string, "manager": string, "confidence": number, "isUser": boolean, "value": number, "notes": string }`

    const userPrompt = `Simulate a ${rounds}-round ${draftTypeLabel} mock draft for this ${numTeams}-team ${league.isDynasty ? 'dynasty' : 'redraft'} ${league.scoring || 'PPR'} league.

Team names in draft order: ${teamNames.join(', ')}

The user controls "${teamNames[userTeamIdx]}" (pick position #${userTeamIdx + 1}).${draftOrderContext}${rosterContext}${adpContext}

Custom settings: ${rounds} rounds • Scoring tweak: ${scoringTweak || 'default'}

Generate all ${rounds * numTeams} picks with realistic player selections based on the ADP data above.${auctionOutputHint}`

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


    const validation = summarizeDraftValidation({
      picks: draftResults,
      constraints: { strict: !casualMode, draftType: draftTypeLabel, expectedPicks: rounds * numTeams },
    })

    if (!validation.valid) {
      return NextResponse.json({
        error: 'Draft validation failed',
        details: validation.errors.slice(0, 10),
      }, { status: 422 })
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

    const proposals = draftTypeLabel === 'auction' ? [] : generateInlineTradeProposals(draftResults, league)

    let proposalsWithReasons = proposals
    if (proposals.length > 0) {
      try {
        const leagueFormat = `${league.scoring || 'PPR'} ${league.isDynasty ? 'dynasty' : 'redraft'}`
        const userManager = draftResults.find((p: any) => p.isUser)?.manager || teamNames[userTeamIdx]

        const reasonPrompt = `You are a fantasy football trade analyst. For each proposed draft-day trade, write a brief 1-sentence reason why this trade makes sense for both sides. Return valid JSON:
{ "reasons": [string] }
Each reason should be concise and mention the key motivation (positional need, value gain, draft capital movement).`

        const reasonUserPrompt = `Generate reasons for these ${proposals.length} draft-day trade proposals in a ${leagueFormat} league:

${proposals.map((p: any, i: number) => `${i + 1}. ${p.fromTeam} (need: ${p.theirTopNeed || 'depth'}, score: ${p.theirNeedScore}) offers pick #${p.fromPick} for ${userManager}'s pick #${p.pickOverall}. Direction: trade ${p.direction}.`).join('\n')}

Return exactly ${proposals.length} reasons in the "reasons" array.`

        const reasonCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: reasonPrompt },
            { role: 'user', content: reasonUserPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.6,
          max_tokens: 1000,
        })

        const reasonContent = reasonCompletion.choices[0]?.message?.content
        if (reasonContent) {
          const reasonParsed = JSON.parse(reasonContent)
          const reasons = reasonParsed.reasons || []
          for (let i = 0; i < proposals.length; i++) {
            proposals[i].reason = reasons[i] || ''
          }
        }
      } catch (aiErr) {
        console.error('[mock-draft] Trade reason generation failed:', aiErr)
      }
      proposalsWithReasons = proposals
    }

    let draftId: string | null = null
    try {
      const saved = await prisma.mockDraft.create({
        data: {
          leagueId,
          userId: session.user.id,
          rounds,
          results: draftResults,
          proposals: proposalsWithReasons.length > 0 ? proposalsWithReasons : [],
        },
      })
      draftId = saved.id
    } catch (saveErr) {
      console.error('[mock-draft] Failed to save draft:', saveErr)
    }

    return NextResponse.json({ draftResults, draftId, proposals: proposalsWithReasons, validationWarnings: validation.warnings })
  } catch (err: any) {
    console.error('[mock-draft] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
