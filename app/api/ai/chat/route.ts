import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'
import { getOpenAIConfig } from '@/lib/openai-client'
import { getUniversalAIContext } from '@/lib/ai-player-context'

const ContextScopeSchema = z.object({
  sleeper_username: z.string(),
  include_legacy: z.boolean().optional().default(true),
})

const ChatRequestSchema = z.object({
  context_scope: ContextScopeSchema,
  message: z.string().min(1).max(2000),
  conversation_history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
})

async function getLegacyContext(sleeperUsername: string) {
  const user = await prisma.legacyUser.findUnique({
    where: { sleeperUsername: sleeperUsername.toLowerCase() },
    include: {
      leagues: { include: { rosters: true } },
      aiReports: {
        where: { reportType: 'legacy' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!user) return null

  const allRosters = user.leagues.flatMap((l) => l.rosters)
  const totalWins = allRosters.reduce((sum, r: any) => sum + (r.wins ?? 0), 0)
  const totalLosses = allRosters.reduce((sum, r: any) => sum + (r.losses ?? 0), 0)
  const championships = allRosters.filter((r: any) => r.isChampion).length

  const aiReport = user.aiReports[0]
  const insights = (aiReport?.insights as Record<string, unknown> | null) ?? null

  const recentLeagues = user.leagues
    .slice()
    .sort((a, b) => b.season - a.season)
    .slice(0, 5)
    .map((l) => {
      const roster = l.rosters[0] as any
      return {
        name: l.name,
        season: l.season,
        record: roster ? `${roster.wins}-${roster.losses}` : 'N/A',
        champion: roster?.isChampion || false,
      }
    })

  return {
    display_name: user.displayName || user.sleeperUsername,
    total_leagues: user.leagues.length,
    total_seasons: Array.from(new Set(user.leagues.map((l) => l.season))).length,
    career_record: `${totalWins}-${totalLosses}`,
    win_percentage:
      totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0,
    championships,
    archetype: (insights?.archetype as string) || 'Unknown',
    rating: aiReport?.rating || null,
    title: aiReport?.title || null,
    strengths: (insights?.strengths as string[]) || [],
    weaknesses: (insights?.weaknesses as string[]) || [],
    recent_leagues: recentLeagues,
  }
}

function buildSystemPrompt(legacyContext: Awaited<ReturnType<typeof getLegacyContext>>) {
  let basePrompt = `You are THE ELITE AllFantasy AI Assistant - the #1 dynasty fantasy sports advisor.

${getUniversalAIContext()}

## YOUR EXPERT KNOWLEDGE
You have encyclopedic knowledge of dynasty fantasy strategy:
- Trading: Buy-low/sell-high tactics, team status exploitation, value assessment
- Waivers: Value creation over points, tier system, contender vs rebuilder adds
- Drafting: Position scarcity, age curves, breakout indicators
- Roster construction: Starter strength, elite advantages, depth management

## TEAM CLASSIFICATION DECISION TREE
You can classify any team using this logic:
1. Does team have 6+ confident starters? If no → REBUILD
2. Has elite difference-maker (top QB/WR/TE)? If yes → CONTENDER
3. Has 2+ future 1sts or young unproductive assets? If yes → REBUILD, else → MIDDLE

## STRATEGY BY TEAM STATUS
- CONTENDERS: Buy points, sell uncertainty. Trade picks for proven starters. Win now.
- REBUILDERS: Sell points, buy value. Trade RBs for picks. Acquire young WRs/QBs.
- MIDDLE: Must choose a lane! Being stuck in the middle is the worst place.

## YOUR ROLE
- Answer questions with SPECIFIC, ACTIONABLE advice
- Use the user's career history to personalize recommendations
- Be honest about weaknesses - users respect directness
- Never make up statistics - only reference what's provided
- ALWAYS apply the tier system when discussing player values
- NEVER suggest unrealistic trades that violate tier rules
- Do NOT call any external APIs - all data comes from the database snapshot provided`

  if (legacyContext) {
    const winPct = legacyContext.win_percentage
    const statusGuess = winPct >= 55 && legacyContext.championships > 0 ? 'CONTENDER' :
                        winPct < 45 ? 'REBUILDER' : 'MIDDLE or TRANSITIONAL'
    
    basePrompt += `

## USER LEGACY CONTEXT (from database)
- Name: ${legacyContext.display_name}
- Career Record: ${legacyContext.career_record} (${winPct}% win rate)
- Championships: ${legacyContext.championships}
- Total Leagues: ${legacyContext.total_leagues} across ${legacyContext.total_seasons} seasons
- Archetype: ${legacyContext.archetype}
- Legacy Rating: ${legacyContext.rating || 'Not yet rated'}/100
- Title: ${legacyContext.title || 'Not assigned'}
- Estimated Status: ${statusGuess}

Strengths: ${legacyContext.strengths.join(', ') || 'Not identified'}
Areas to improve: ${legacyContext.weaknesses.join(', ') || 'Not identified'}

Recent League History:
${legacyContext.recent_leagues
  .map((l) => `- ${l.name} (${l.season}): ${l.record}${l.champion ? ' - CHAMPION' : ''}`)
  .join('\n')}

Use this context to personalize your responses. Tailor advice to their estimated team status.
Reference their history and patterns when giving recommendations.`
  }

  return basePrompt
}

export const POST = withApiUsage({ endpoint: "/api/ai/chat", tool: "AiChat" })(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const parseResult = ChatRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { context_scope, message, conversation_history } = parseResult.data
    const sleeperUsername = context_scope.sleeper_username?.trim()?.toLowerCase()

    if (!sleeperUsername) {
      return NextResponse.json({ error: 'Missing sleeper_username' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const rl = consumeRateLimit({
      scope: 'ai',
      action: 'chat',
      sleeperUsername,
      ip,
      maxRequests: 20,
      windowMs: 60_000,
      includeIpInKey: true,
    })

    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.', retryAfterSec: rl.retryAfterSec, remaining: rl.remaining },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    let legacyContext: any = null
    if (context_scope.include_legacy) {
      legacyContext = await getLegacyContext(sleeperUsername)
    }

    if (!legacyContext) {
      return NextResponse.json({ error: 'User not found. Please import your Sleeper data first.' }, { status: 404 })
    }

    const systemPrompt = buildSystemPrompt(legacyContext)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-10),
      { role: 'user', content: message },
    ]

    const { apiKey, baseUrl } = getOpenAIConfig()

    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      console.error('AI Chat OpenAI error:', { status: resp.status, errText: errText.slice(0, 500) })
      return NextResponse.json(
        { error: 'Failed to process chat', details: errText.slice(0, 500) },
        { status: 500 }
      )
    }

    const completion = await resp.json().catch(() => null)
    const responseText = completion?.choices?.[0]?.message?.content

    if (!responseText) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      response: responseText,
      legacy_context: {
        included: true,
        display_name: legacyContext.display_name,
        archetype: legacyContext.archetype,
      },
      rate_limit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
    })
  } catch (error) {
    console.error('AI Chat error:', error)
    return NextResponse.json({ error: 'Failed to process chat', details: String(error) }, { status: 500 })
  }
})
