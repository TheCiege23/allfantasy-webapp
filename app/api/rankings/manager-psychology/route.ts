import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openaiChatJson } from '@/lib/openai-client'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'

interface ManagerData {
  username: string
  rosterId: number
  record: { wins: number; losses: number; ties: number }
  pointsFor: number
  pointsAgainst: number
  trades: {
    total: number
    playersGiven: number
    playersReceived: number
    picksGiven: number
    picksReceived: number
    avgValueDiff: number | null
    tradingStyle: any
    favoriteTargets: any
  }
  rosterSize: number
  isChampion: boolean
  playoffSeed: number | null
  finalStanding: number | null
}

export const POST = withApiUsage({ endpoint: "/api/rankings/manager-psychology", tool: "ManagerPsychology" })(async (request: NextRequest) => {
  const ip = getClientIp(request)
  const rateLimitResult = consumeRateLimit({
    scope: 'legacy',
    action: 'manager_psychology',
    ip,
    maxRequests: 10,
    windowMs: 60000,
  })

  if (!rateLimitResult.success) {
    return NextResponse.json({
      error: 'Rate limited. Please wait before trying again.',
      retryAfter: rateLimitResult.retryAfterSec,
    }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { leagueId, rosterId, username, teamData } = body

    if (!leagueId || rosterId == null) {
      return NextResponse.json({ error: 'leagueId and rosterId required' }, { status: 400 })
    }

    const managerName = username || teamData?.displayName || teamData?.username || `Manager #${rosterId}`

    let tradeData = {
      total: 0,
      playersGiven: 0,
      playersReceived: 0,
      picksGiven: 0,
      picksReceived: 0,
      avgValueDiff: null as number | null,
      tradingStyle: null as any,
      favoriteTargets: null as any,
      positionsAcquired: {} as Record<string, number>,
      positionsTraded: {} as Record<string, number>,
      youthCount: 0,
      vetCount: 0,
    }

    if (username) {
      const tradeHistory = await prisma.leagueTradeHistory.findFirst({
        where: {
          sleeperLeagueId: leagueId,
          sleeperUsername: username,
        },
        include: {
          trades: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })

      if (tradeHistory) {
        let totalValueDiff = 0
        let valuedTrades = 0
        for (const trade of tradeHistory.trades) {
          const pGiven = trade.playersGiven as any[] || []
          const pReceived = trade.playersReceived as any[] || []
          const dkGiven = trade.picksGiven as any[] || []
          const dkReceived = trade.picksReceived as any[] || []
          tradeData.playersGiven += pGiven.length
          tradeData.playersReceived += pReceived.length
          tradeData.picksGiven += dkGiven.length
          tradeData.picksReceived += dkReceived.length

          for (const p of pReceived) {
            if (p.position) tradeData.positionsAcquired[p.position] = (tradeData.positionsAcquired[p.position] || 0) + 1
            if (p.age && p.age < 25) tradeData.youthCount++
            if (p.age && p.age >= 28) tradeData.vetCount++
          }
          for (const p of pGiven) {
            if (p.position) tradeData.positionsTraded[p.position] = (tradeData.positionsTraded[p.position] || 0) + 1
          }

          if (trade.valueDifferential != null) {
            totalValueDiff += trade.valueDifferential
            valuedTrades++
          }
        }

        tradeData.total = tradeHistory.trades.length
        tradeData.avgValueDiff = valuedTrades > 0 ? totalValueDiff / valuedTrades : null
        tradeData.tradingStyle = tradeHistory.tradingStyle
        tradeData.favoriteTargets = tradeHistory.favoriteTargets
      }
    }

    const record = teamData?.record || { wins: 0, losses: 0, ties: 0 }
    const totalGames = record.wins + record.losses + record.ties
    const winPct = totalGames > 0 ? (record.wins / totalGames * 100).toFixed(1) : '0'

    const posAcqSummary = Object.entries(tradeData.positionsAcquired)
      .sort((a, b) => b[1] - a[1])
      .map(([pos, ct]) => `${pos}: ${ct}`)
      .join(', ')

    const posTrdSummary = Object.entries(tradeData.positionsTraded)
      .sort((a, b) => b[1] - a[1])
      .map(([pos, ct]) => `${pos}: ${ct}`)
      .join(', ')

    const prompt = `You are a fantasy sports psychologist. Analyze this manager's behavior and create a psychological profile. Be insightful, specific, and grounded in the data. Never invent stats.

MANAGER: ${managerName}
RECORD: ${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''} (${winPct}% win rate)
POINTS FOR: ${teamData?.pointsFor?.toFixed(1) || 'N/A'}
POINTS AGAINST: ${teamData?.pointsAgainst?.toFixed(1) || 'N/A'}
EXPECTED WINS: ${teamData?.expectedWins?.toFixed(1) || 'N/A'}
LUCK DELTA: ${teamData?.luckDelta || 'N/A'} wins
STREAK: ${teamData?.streak > 0 ? `${teamData.streak}W streak` : teamData?.streak < 0 ? `${Math.abs(teamData.streak)}L streak` : 'No streak'}
COMPOSITE SCORE: ${teamData?.composite || 'N/A'}/100
POWER SCORE: ${teamData?.powerScore || 'N/A'}/100
MANAGER SKILL SCORE: ${teamData?.managerSkillScore || 'N/A'}/100

TRADE ACTIVITY:
- Total trades: ${tradeData.total}
- Players given: ${tradeData.playersGiven} | Players received: ${tradeData.playersReceived}
- Picks given: ${tradeData.picksGiven} | Picks received: ${tradeData.picksReceived}
- Avg value differential: ${tradeData.avgValueDiff !== null ? (tradeData.avgValueDiff > 0 ? '+' : '') + tradeData.avgValueDiff.toFixed(1) : 'N/A'}
- Positions acquired: ${posAcqSummary || 'None'}
- Positions traded away: ${posTrdSummary || 'None'}
- Youth acquisitions (under 25): ${tradeData.youthCount}
- Veteran acquisitions (28+): ${tradeData.vetCount}
${tradeData.tradingStyle ? `- Trading style: ${JSON.stringify(tradeData.tradingStyle)}` : ''}
${tradeData.favoriteTargets ? `- Favorite targets: ${JSON.stringify(tradeData.favoriteTargets)}` : ''}

TEAM PHASE: ${teamData?.phase || 'Unknown'}

Respond with JSON matching this exact structure:
{
  "archetype": "short 2-3 word archetype name (e.g. 'The Shark', 'The Hoarder', 'The Gambler', 'The Architect', 'The Sniper', 'The Tinkerer')",
  "emoji": "single emoji that represents the archetype",
  "summary": "2-3 sentence psychological summary of this manager's approach to fantasy football",
  "traits": [
    { "trait": "trait name", "score": 0-100, "description": "one sentence about this trait" }
  ],
  "tendencies": ["tendency 1", "tendency 2", "tendency 3"],
  "blindSpot": "one sentence about a potential blind spot or weakness in their approach",
  "negotiationStyle": "one sentence about how they likely approach trade negotiations",
  "riskProfile": "LOW" | "MEDIUM" | "HIGH",
  "decisionSpeed": "IMPULSIVE" | "DELIBERATE" | "REACTIVE"
}

Include exactly 4 traits. Make traits from these categories: Risk Tolerance, Patience, Aggression, Adaptability. Scores should be 0-100.`

    const result = await openaiChatJson({
      messages: [
        { role: 'system', content: 'You are AllFantasy AI Psychology Engine. Respond with valid JSON only. No markdown, no code blocks. Be honest and data-driven.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 600,
    })

    if (!result.ok) {
      return NextResponse.json({
        archetype: tradeData.total >= 5 ? 'The Active Manager' : 'The Observer',
        emoji: tradeData.total >= 5 ? '📊' : '👀',
        summary: `${managerName} has a ${record.wins}-${record.losses} record with ${tradeData.total} trade${tradeData.total !== 1 ? 's' : ''} this season. ${tradeData.total >= 3 ? 'An active trader who likes to shake things up.' : 'A steady manager who prefers to let the roster play out.'}`,
        traits: [
          { trait: 'Risk Tolerance', score: tradeData.total >= 5 ? 65 : 40, description: tradeData.total >= 5 ? 'Willing to make moves and accept risk.' : 'Prefers stability over risk.' },
          { trait: 'Patience', score: tradeData.total >= 5 ? 35 : 70, description: tradeData.total >= 5 ? 'Quick to act on roster changes.' : 'Willing to wait for the right opportunity.' },
          { trait: 'Aggression', score: record.wins > record.losses ? 60 : 45, description: record.wins > record.losses ? 'Plays to win with a competitive edge.' : 'Takes a measured approach to competition.' },
          { trait: 'Adaptability', score: 50, description: 'Shows average ability to adjust strategy mid-season.' },
        ],
        tendencies: ['Prefers set-it-and-forget-it lineup management', 'Relies on initial draft capital', 'Conservative trade approach'],
        blindSpot: 'May miss opportunities by not being active enough on the trade market.',
        negotiationStyle: 'Straightforward and value-focused.',
        riskProfile: 'MEDIUM',
        decisionSpeed: 'DELIBERATE',
        fallback: true,
      })
    }

    let parsed: any
    try {
      const content = result.json?.choices?.[0]?.message?.content
      if (typeof content === 'string') {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        parsed = JSON.parse(cleaned)
      } else {
        parsed = result.json
      }
    } catch {
      parsed = null
    }

    if (parsed?.archetype) {
      return NextResponse.json(parsed)
    }

    return NextResponse.json({
        archetype: tradeData.total >= 5 ? 'The Active Manager' : 'The Observer',
        emoji: tradeData.total >= 5 ? '📊' : '👀',
        summary: `${managerName} has a ${record.wins}-${record.losses} record with ${tradeData.total} trade${tradeData.total !== 1 ? 's' : ''} this season. ${tradeData.total >= 3 ? 'An active trader who likes to shake things up.' : 'A steady manager who prefers to let the roster play out.'}`,
        traits: [
          { trait: 'Risk Tolerance', score: tradeData.total >= 5 ? 65 : 40, description: tradeData.total >= 5 ? 'Willing to make moves and accept risk.' : 'Prefers stability over risk.' },
          { trait: 'Patience', score: tradeData.total >= 5 ? 35 : 70, description: tradeData.total >= 5 ? 'Quick to act on roster changes.' : 'Willing to wait for the right opportunity.' },
          { trait: 'Aggression', score: record.wins > record.losses ? 60 : 45, description: record.wins > record.losses ? 'Plays to win with a competitive edge.' : 'Takes a measured approach to competition.' },
          { trait: 'Adaptability', score: 50, description: 'Shows average ability to adjust strategy mid-season.' },
        ],
        tendencies: ['Prefers set-it-and-forget-it lineup management', 'Relies on initial draft capital', 'Conservative trade approach'],
        blindSpot: 'May miss opportunities by not being active enough on the trade market.',
        negotiationStyle: 'Straightforward and value-focused.',
        riskProfile: 'MEDIUM',
        decisionSpeed: 'DELIBERATE',
        fallback: true,
      })
  } catch (err: any) {
    console.error('[Manager Psychology] Error:', err?.message || err)
    return NextResponse.json(
      { error: 'Failed to generate psychology profile' },
      { status: 500 },
    )
  }
})
