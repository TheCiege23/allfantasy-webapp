import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { openaiChatJson, parseJsonContentFromChatCompletion } from '@/lib/openai-client'
import { classifyTeam, type RosterPlayer } from '@/lib/teamClassifier'
import { buildTradeAnalysisPrompt, type TradeAnalysisResponse } from '@/lib/prompts/tradeAnalyzer'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { give, get, leagueId, userRoster, futurePicksCount = 0, leagueSettings = '' } = body

  if (!give?.length || !get?.length || !leagueId || !userRoster?.length) {
    return NextResponse.json(
      { error: 'Missing required fields: give, get, leagueId, userRoster' },
      { status: 400 }
    )
  }

  try {
    const rosterPlayers: RosterPlayer[] = userRoster.map((p: any) => ({
      playerId: p.playerId || p.id || '',
      position: p.position || p.pos || '',
      projectedPoints: p.projectedPoints,
      age: p.age,
      isStarter: p.isStarter ?? p.slot === 'Starter',
    }))

    const { archetype, score, explanation, positionalNeeds } = await classifyTeam(
      leagueId,
      rosterPlayers,
      futurePicksCount
    )

    const giveNames = give.map((p: any) => p.name || p.playerName || 'Unknown').join(', ')
    const getNames = get.map((p: any) => p.name || p.playerName || 'Unknown').join(', ')

    const prompt = buildTradeAnalysisPrompt(
      giveNames,
      getNames,
      leagueSettings || 'Dynasty SF PPR',
      archetype,
      explanation,
      positionalNeeds,
      futurePicksCount
    )

    const result = await openaiChatJson({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.65,
      maxTokens: 1200,
    })

    if (!result.ok) {
      console.error('[Trade Analyze] OpenAI error:', result.details)
      return NextResponse.json(
        { error: 'AI analysis failed. Please try again.' },
        { status: 502 }
      )
    }

    const rawContent = result.json?.choices?.[0]?.message?.content
    let analysis: TradeAnalysisResponse

    try {
      analysis = JSON.parse(rawContent || '{}')
    } catch {
      console.error('[Trade Analyze] Failed to parse AI response:', rawContent)
      return NextResponse.json(
        { error: 'AI returned an invalid response. Please retry.' },
        { status: 502 }
      )
    }

    try {
      await prisma.tradeAnalysisSnapshot.create({
        data: {
          leagueId,
          sleeperUsername: session?.user?.name || session?.user?.email || 'unknown',
          snapshotType: 'archetype-trade',
          payloadJson: {
            give: give.map((p: any) => p.id || p.playerId),
            get: get.map((p: any) => p.id || p.playerId),
            archetype,
            score,
            verdict: analysis.verdict,
            confidence: analysis.confidence,
            fairness: analysis.fairness,
          },
        },
      })
    } catch (e) {
      console.warn('[Trade Analyze] Snapshot save failed (non-critical):', e)
    }

    return NextResponse.json({
      success: true,
      analysis,
      archetypeData: { archetype, score, explanation, positionalNeeds },
    })
  } catch (error: any) {
    console.error('[Trade Analyze] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    )
  }
}
