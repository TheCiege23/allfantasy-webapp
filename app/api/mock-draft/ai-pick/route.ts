import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' })

const POSITION_TARGETS: Record<string, { starter: number; ideal: number }> = {
  QB: { starter: 1, ideal: 2 },
  RB: { starter: 2, ideal: 4 },
  WR: { starter: 2, ideal: 4 },
  TE: { starter: 1, ideal: 2 },
  K: { starter: 1, ideal: 1 },
  DEF: { starter: 1, ideal: 1 },
}

function computeTeamNeeds(roster: { position: string }[], rosterSlots: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of roster) {
    counts[p.position] = (counts[p.position] || 0) + 1
  }

  const needs: Record<string, number> = {}
  for (const [pos, targets] of Object.entries(POSITION_TARGETS)) {
    const count = counts[pos] || 0
    if (count < targets.starter) {
      needs[pos] = 90 + (targets.starter - count) * 10
    } else if (count < targets.ideal) {
      needs[pos] = 40 + (targets.ideal - count) * 15
    } else {
      needs[pos] = 5
    }
  }

  const slotCounts: Record<string, number> = {}
  for (const s of rosterSlots) {
    slotCounts[s] = (slotCounts[s] || 0) + 1
  }
  if ((slotCounts['QB'] || 0) >= 2 || (slotCounts['SUPER_FLEX'] || 0) > 0) {
    needs['QB'] = Math.min(100, (needs['QB'] || 50) + 15)
  }

  return needs
}

function pickByNeeds(
  available: any[],
  teamRoster: { position: string }[],
  rosterSlots: string[],
  mode: 'needs' | 'bpa' = 'needs'
): any | null {
  if (available.length === 0) return null
  if (mode === 'bpa') return available[0]

  const needs = computeTeamNeeds(teamRoster, rosterSlots)

  let bestPlayer: any = null
  let bestScore = -Infinity

  for (const player of available.slice(0, 30)) {
    const posNeed = needs[player.position] || 10
    const adpBonus = Math.max(0, 100 - (player.adp || 999))
    const score = posNeed * 2 + adpBonus
    if (score > bestScore) {
      bestScore = score
      bestPlayer = player
    }
  }

  return bestPlayer || available[0]
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      action = 'pick',
      available = [],
      teamRoster = [],
      rosterSlots = [],
      draftedSoFar = [],
      round = 1,
      pick = 1,
      totalRounds = 4,
      totalTeams = 12,
      managerName = 'AI Manager',
      isDynasty = true,
      isSF = false,
      isRookieDraft = false,
      mode = 'needs',
    } = body

    if (action === 'pick') {
      const effectiveSlots = isSF ? [...rosterSlots, 'SUPER_FLEX'] : rosterSlots
      const selected = pickByNeeds(available, teamRoster, effectiveSlots, mode)

      if (!selected) {
        return NextResponse.json({ error: 'No available players' }, { status: 400 })
      }

      return NextResponse.json({
        pick: {
          playerName: selected.name,
          position: selected.position,
          team: selected.team,
          adp: selected.adp,
          sleeperId: selected.sleeperId || null,
          isRookie: selected.isRookie || false,
        },
        reasoning: `${managerName} needed ${selected.position} depth. ${selected.name} was the best available at ADP ${selected.adp?.toFixed(1) || 'N/A'}.`,
      })
    }

    if (action === 'dm-suggestion') {
      const effectiveSlots = isSF ? [...rosterSlots, 'SUPER_FLEX'] : rosterSlots
      const needs = computeTeamNeeds(teamRoster, effectiveSlots)

      const topNeeds = Object.entries(needs)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)

      const topAvailable = available.slice(0, 15)
      const rosterSummary = teamRoster.reduce((acc: Record<string, number>, p: { position: string }) => {
        acc[p.position] = (acc[p.position] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const needsPick = pickByNeeds(available, teamRoster, effectiveSlots, 'needs')
      const bpaPick = available[0]

      const suggestions = []

      if (needsPick) {
        suggestions.push({
          player: needsPick.name,
          position: needsPick.position,
          team: needsPick.team,
          adp: needsPick.adp,
          reason: `Fills your top need at ${needsPick.position}`,
          type: 'need',
        })
      }

      if (bpaPick && bpaPick.name !== needsPick?.name) {
        suggestions.push({
          player: bpaPick.name,
          position: bpaPick.position,
          team: bpaPick.team,
          adp: bpaPick.adp,
          reason: `Best player available by ADP (${bpaPick.adp?.toFixed(1)})`,
          type: 'bpa',
        })
      }

      const valuePick = available.find((p: any) =>
        p.adp && p.adp < (round - 1) * totalTeams + pick - 3 &&
        p.name !== needsPick?.name &&
        p.name !== bpaPick?.name
      )
      if (valuePick) {
        suggestions.push({
          player: valuePick.name,
          position: valuePick.position,
          team: valuePick.team,
          adp: valuePick.adp,
          reason: `Value pick - ADP ${valuePick.adp?.toFixed(1)} falling to pick ${(round - 1) * totalTeams + pick}`,
          type: 'value',
        })
      }

      let aiInsight = ''
      try {
        const prompt = `You are a fantasy football draft advisor. The user is on the clock at pick ${(round - 1) * totalTeams + pick} (Round ${round}, Pick ${pick}) in a ${totalTeams}-team ${isDynasty ? 'dynasty' : 'redraft'} ${isRookieDraft ? 'rookie ' : ''}draft${isSF ? ' (Superflex)' : ''}.

Their roster: ${JSON.stringify(rosterSummary)}
Top needs: ${topNeeds.map(([pos, score]) => `${pos} (need: ${score})`).join(', ')}
Top 10 available: ${topAvailable.slice(0, 10).map((p: any) => `${p.name} (${p.position}, ADP ${p.adp?.toFixed(1)})`).join(', ')}

Give a 2-sentence recommendation for who they should draft and why. Be specific about the player name.`

        const resp = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.7,
        })
        aiInsight = resp.choices[0]?.message?.content || ''
      } catch {
        aiInsight = ''
      }

      return NextResponse.json({
        suggestions,
        needs: Object.fromEntries(topNeeds),
        rosterCounts: rosterSummary,
        aiInsight,
        round,
        pick,
        overall: (round - 1) * totalTeams + pick,
      })
    }

    if (action === 'trade-proposal') {
      const {
        userPicks = [],
        targetPick = null,
        otherManagerRoster = [],
        otherManagerName = 'Other Manager',
      } = body

      if (!targetPick || userPicks.length === 0) {
        return NextResponse.json({ error: 'userPicks and targetPick required' }, { status: 400 })
      }

      const otherNeeds = computeTeamNeeds(otherManagerRoster, rosterSlots)
      const userNeeds = computeTeamNeeds(teamRoster, rosterSlots)

      const targetOverall = (targetPick.round - 1) * totalTeams + targetPick.pick
      const proposals = []

      for (const userPickItem of userPicks) {
        const userOverall = (userPickItem.round - 1) * totalTeams + userPickItem.pick
        const diff = Math.abs(targetOverall - userOverall)
        if (diff < 2 || diff > 15) continue

        const isTradeUp = targetOverall < userOverall
        proposals.push({
          youGive: `Round ${userPickItem.round} Pick ${userPickItem.pick} (#${userOverall} overall)`,
          youGet: `Round ${targetPick.round} Pick ${targetPick.pick} (#${targetOverall} overall)`,
          direction: isTradeUp ? 'up' : 'down',
          fairness: diff <= 5 ? 'fair' : diff <= 10 ? 'slight-overpay' : 'significant-overpay',
          otherManagerTopNeed: Object.entries(otherNeeds).sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown',
          reasoning: isTradeUp
            ? `Trading up ${diff} spots to secure a higher-rated prospect.`
            : `Trading down ${diff} spots for extra draft capital.`,
        })
      }

      return NextResponse.json({
        proposals: proposals.slice(0, 3),
        otherManager: otherManagerName,
        otherNeeds: Object.fromEntries(Object.entries(otherNeeds).sort(([, a], [, b]) => b - a).slice(0, 3)),
      })
    }

    return NextResponse.json({ error: 'Invalid action. Use: pick, dm-suggestion, trade-proposal' }, { status: 400 })
  } catch (err: any) {
    console.error('[mock-draft/ai-pick] Error:', err)
    return NextResponse.json({ error: err.message || 'AI pick failed' }, { status: 500 })
  }
}
