import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { openaiChatText } from '@/lib/openai-client'
import { xaiChatJson, parseTextFromXaiChatCompletion } from '@/lib/xai-client'
import { deepseekChat, deepseekQuantAnalysis } from '@/lib/deepseek-client'
import { enrichChatWithData, buildDataSourcesSummary } from '@/lib/chat-data-enrichment'
import { getFullAIContext, buildMemoryPromptSection, recordMemoryEvent } from '@/lib/ai-memory'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

export type StrategyMode =
  | 'conservative'
  | 'aggressive'
  | 'win_now'
  | 'rebuild'
  | 'playoff_lock'
  | 'chaos'

export type ToolKey =
  | 'trade_analyzer'
  | 'trade_finder'
  | 'waiver_ai'
  | 'rankings'
  | 'mock_draft'
  | 'none'

interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

interface QuantResult {
  projectionDelta?: number
  expectedWeeklyGain?: number
  winProbability?: number
  playoffOdds?: number
  fairnessScore?: number
  riskGrade?: 'A' | 'B' | 'C' | 'D' | 'F'
  confidencePct?: number
  ceilingScore?: number
  floorScore?: number
  varianceScore?: number
  simulationCount?: number
  error?: string
}

interface GrokResult {
  trendSignals?: string[]
  injuryAlerts?: string[]
  snapShareChanges?: string[]
  socialBuzz?: string[]
  momentumFlags?: string[]
  rawInsight?: string
  error?: string
}

interface ChimmyResponse {
  answer: string
  recommendedTool: ToolKey
  reason: string
  quantData?: QuantResult
  trendData?: GrokResult
  confidencePct?: number
  strategyNote?: string
  providers: {
    openai: 'ok' | 'error' | 'skipped'
    grok: 'ok' | 'error' | 'skipped'
    deepseek: 'ok' | 'error' | 'skipped'
  }
  dataSources: string[]
  processingMs?: number
}

const TOOL_LINKS: Record<ToolKey, string | null> = {
  trade_analyzer: '/trade-evaluator',
  trade_finder:   '/trade-finder',
  waiver_ai:      '/waiver-ai',
  rankings:       '/rankings',
  mock_draft:     '/mock-draft-simulator',
  none:           null,
}

const VALID_TOOL_KEYS = new Set<string>([
  'trade_analyzer', 'trade_finder', 'waiver_ai', 'rankings', 'mock_draft', 'none',
])

const SPORTS_KEYWORDS = [
  'trade', 'waiver', 'draft', 'player', 'pick', 'roster', 'lineup',
  'start', 'sit', 'drop', 'add', 'quarterback', 'receiver', 'running back',
  'tight end', 'kicker', 'defense', 'fantasy', 'points', 'league', 'playoffs',
  'standings', 'bench', 'injury', 'bye week', 'matchup', 'projection',
  'qb', 'rb', 'wr', 'te', 'flex', 'superflex', 'ppr', 'dynasty', 'keeper',
  'faab', 'auction', 'nfl', 'nba', 'mlb', 'basketball', 'baseball', 'football',
]

const STRATEGY_MODE_CONTEXT: Record<StrategyMode, string> = {
  conservative:  'Prioritize floor, minimize risk, favor proven veterans and stable roles.',
  aggressive:    'Maximize upside, favor volatile high-ceiling plays, accept higher risk.',
  win_now:       'All-in for immediate wins. Deprioritize future value completely.',
  rebuild:       'Target youth, picks, and long-term upside. Accept short-term losses.',
  playoff_lock:  'Focus on securing playoff spot. Balance floor and matchup advantage.',
  chaos:         'High variance plays only. Swing big or go home.',
}

function getVisionClient(): OpenAI | null {
  const key = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    return new OpenAI({
      apiKey: key,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    })
  } catch {
    return null
  }
}

function buildDomainGuard(strategyMode?: StrategyMode): string {
  const strategyContext = strategyMode
    ? `\nActive Strategy Mode: ${strategyMode.toUpperCase()} — ${STRATEGY_MODE_CONTEXT[strategyMode]}`
    : ''

  return `You are Chimmy — AllFantasy's AI fantasy sports co-manager.

PERSONALITY:
- Intelligent but conversational, never robotic
- Data-backed but human — explain numbers in plain English
- Competitive but calm under volatility
- Warm, direct, supportive
- Never guarantee outcomes — always show confidence scores
- Differentiate clearly between projection and certainty

SCOPE: Fantasy sports and real sports only. If asked about anything else, politely redirect.
${strategyContext}

RESPONSE FORMAT (strict JSON):
{
  "answer": "Your full response in Chimmy's voice",
  "recommendedTool": "trade_analyzer|trade_finder|waiver_ai|rankings|mock_draft|none",
  "reason": "Why you recommended that tool (or 'none' if no tool needed)",
  "confidencePct": 0-100,
  "strategyNote": "Optional note about how strategy mode affects this advice"
}

TONE GUIDE:
Instead of: "The expected value change is 4.3 points."
Say: "This move gives you about a 4-point weekly edge. In tight matchups, that's the difference between playoffs and regret."

Always lead with the most important insight. Keep answers under 300 words unless deep analysis is requested.`
}

function buildGrokSystemPrompt(): string {
  return `You are the real-time intelligence layer for Chimmy, an AI fantasy sports assistant.

YOUR ROLE: Detect breaking trends, injury signals, momentum shifts, and social buzz.

Focus on:
- Breaking injury updates and practice reports
- Snap count changes and target share shifts
- Depth chart movements
- Coach quotes affecting fantasy value
- Social media sentiment spikes
- Unexpected usage patterns
- Trade rumors affecting player value

RESPONSE FORMAT (strict JSON):
{
  "trendSignals": ["signal1", "signal2"],
  "injuryAlerts": ["alert1"],
  "snapShareChanges": ["change1"],
  "socialBuzz": ["buzz1"],
  "momentumFlags": ["flag1"],
  "rawInsight": "Brief paragraph of most important real-time context"
}`
}

function buildDeepSeekSystemPrompt(strategyMode?: StrategyMode): string {
  const modeContext = strategyMode
    ? `Strategy Mode: ${strategyMode} — ${STRATEGY_MODE_CONTEXT[strategyMode]}`
    : ''

  return `You are the quantitative modeling engine for Chimmy, an AI fantasy sports assistant.

YOUR ROLE: Run numerical analysis, simulations, and projections.
${modeContext}

Focus on:
- Expected value calculations
- Win probability modeling
- Trade fairness scoring
- Ceiling/floor projections
- Variance and risk scoring
- Playoff path probability
- Rest-of-season projections

RESPONSE FORMAT (strict JSON):
{
  "projectionDelta": number or null,
  "expectedWeeklyGain": number or null,
  "winProbability": 0-100 or null,
  "playoffOdds": 0-100 or null,
  "fairnessScore": 0-100 or null,
  "riskGrade": "A|B|C|D|F" or null,
  "confidencePct": 0-100,
  "ceilingScore": number or null,
  "floorScore": number or null,
  "varianceScore": 0-100 or null,
  "simulationCount": number or null,
  "reasoning": "Brief explanation of your calculations"
}`
}

function buildPrompt(params: {
  question: string
  conversation: ConversationTurn[]
  userContext: string
  screenshotContext: string
  enrichmentData: string
  privateMode: boolean
  targetUsername?: string
  strategyMode?: StrategyMode
  aiMemory?: string
}): string {
  const {
    question,
    conversation,
    userContext,
    screenshotContext,
    enrichmentData,
    privateMode,
    targetUsername,
    strategyMode,
    aiMemory,
  } = params

  const sections: string[] = []

  sections.push(`USER QUESTION:\n${question}`)

  if (strategyMode) {
    sections.push(`STRATEGY MODE: ${strategyMode.toUpperCase()}\n${STRATEGY_MODE_CONTEXT[strategyMode]}`)
  }

  if (privateMode && targetUsername) {
    sections.push(`PRIVATE MODE: Analyzing for user: ${targetUsername}`)
  }

  if (aiMemory) {
    sections.push(`USER BEHAVIORAL PROFILE:\n${aiMemory}`)
  }

  if (conversation.length > 0) {
    const historyText = conversation
      .slice(-10)
      .map(t => `${t.role === 'user' ? 'User' : 'Chimmy'}: ${t.content}`)
      .join('\n')
    sections.push(`RECENT CONVERSATION:\n${historyText}`)
  }

  if (userContext) {
    sections.push(`USER FANTASY CONTEXT:\n${userContext}`)
  }

  if (screenshotContext) {
    sections.push(`SCREENSHOT ANALYSIS:\n${screenshotContext}`)
  }

  if (enrichmentData) {
    sections.push(`REAL-TIME DATA:\n${enrichmentData}`)
  }

  return sections.join('\n\n---\n\n')
}

function normalizeToolKey(raw: string | undefined): ToolKey {
  if (!raw) return 'none'
  const cleaned = raw.toLowerCase().trim()
  return VALID_TOOL_KEYS.has(cleaned) ? (cleaned as ToolKey) : 'none'
}

function parseJsonResponse(raw: string): Record<string, any> | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    return JSON.parse(cleaned)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
    return null
  }
}

function buildChimmyVoiceAnswer(
  openaiAnswer: string,
  grokResult: GrokResult | null,
  quantResult: QuantResult | null,
  _strategyMode?: StrategyMode
): string {
  let answer = openaiAnswer

  if (quantResult && !quantResult.error) {
    const quantInsights: string[] = []

    if (quantResult.expectedWeeklyGain != null && Math.abs(quantResult.expectedWeeklyGain) > 0.5) {
      const direction = quantResult.expectedWeeklyGain > 0 ? 'gain' : 'cost'
      quantInsights.push(
        `**Quant Edge:** ~${Math.abs(quantResult.expectedWeeklyGain).toFixed(1)} pts/week ${direction}`
      )
    }

    if (quantResult.fairnessScore != null) {
      const fairLabel =
        quantResult.fairnessScore >= 55 ? 'Fair' :
        quantResult.fairnessScore >= 45 ? 'Slight Lean' : 'Lopsided'
      quantInsights.push(`**Trade Fairness:** ${quantResult.fairnessScore}/100 — ${fairLabel}`)
    }

    if (quantResult.playoffOdds != null) {
      quantInsights.push(`**Playoff Impact:** ${quantResult.playoffOdds > 50 ? '+' : ''}${quantResult.playoffOdds}% odds`)
    }

    if (quantResult.riskGrade) {
      quantInsights.push(`**Risk Grade:** ${quantResult.riskGrade}`)
    }

    if (quantInsights.length > 0) {
      answer += '\n\n' + quantInsights.join('\n')
    }
  }

  if (grokResult && !grokResult.error) {
    const trendAlerts: string[] = []

    if (grokResult.injuryAlerts?.length) {
      trendAlerts.push(`**Injury Alert:** ${grokResult.injuryAlerts.slice(0, 2).join(' | ')}`)
    }

    if (grokResult.momentumFlags?.length) {
      trendAlerts.push(`**Momentum:** ${grokResult.momentumFlags.slice(0, 2).join(' | ')}`)
    }

    if (grokResult.snapShareChanges?.length) {
      trendAlerts.push(`**Usage Shift:** ${grokResult.snapShareChanges[0]}`)
    }

    if (trendAlerts.length > 0) {
      answer += '\n\n' + trendAlerts.join('\n')
    }
  }

  if (quantResult?.confidencePct != null) {
    answer += `\n\n_Confidence: ${quantResult.confidencePct}%_`
  }

  return answer
}

interface ConsensusResult {
  answer: string
  recommendedTool: ToolKey
  reason: string
  confidencePct?: number
  strategyNote?: string
  quantData?: QuantResult
  trendData?: GrokResult
}

function buildConsensus(
  openaiRaw: string,
  grokRaw: string,
  deepseekResult: QuantResult | null,
  strategyMode?: StrategyMode
): ConsensusResult {
  const openaiJson = parseJsonResponse(openaiRaw)

  let grokResult: GrokResult | null = null
  if (grokRaw) {
    const grokJson = parseJsonResponse(grokRaw)
    if (grokJson) {
      grokResult = {
        trendSignals:     grokJson.trendSignals ?? [],
        injuryAlerts:     grokJson.injuryAlerts ?? [],
        snapShareChanges: grokJson.snapShareChanges ?? [],
        socialBuzz:       grokJson.socialBuzz ?? [],
        momentumFlags:    grokJson.momentumFlags ?? [],
        rawInsight:       grokJson.rawInsight ?? '',
      }
    }
  }

  let primaryAnswer: string
  let recommendedTool: ToolKey
  let reason: string
  let strategyNote: string | undefined
  let confidencePct: number | undefined

  if (openaiJson?.answer) {
    primaryAnswer = openaiJson.answer
    recommendedTool = normalizeToolKey(openaiJson.recommendedTool)
    reason = openaiJson.reason ?? ''
    confidencePct = openaiJson.confidencePct ?? deepseekResult?.confidencePct
    strategyNote = openaiJson.strategyNote
  } else if (openaiRaw && openaiRaw.trim().length > 10) {
    primaryAnswer = openaiRaw
    recommendedTool = 'none'
    reason = ''
    confidencePct = deepseekResult?.confidencePct
  } else if (grokResult?.rawInsight) {
    primaryAnswer = grokResult.rawInsight
    recommendedTool = 'none'
    reason = 'Grok real-time intelligence (primary model unavailable)'
    confidencePct = deepseekResult?.confidencePct
  } else if (grokRaw && grokRaw.trim().length > 10) {
    primaryAnswer = grokRaw
    recommendedTool = 'none'
    reason = 'Grok fallback (primary model unavailable)'
    confidencePct = deepseekResult?.confidencePct
  } else {
    primaryAnswer = "I couldn't complete the analysis right now."
    recommendedTool = 'none'
    reason = ''
    confidencePct = undefined
  }

  const answer = buildChimmyVoiceAnswer(primaryAnswer, grokResult, deepseekResult, strategyMode)

  return {
    answer,
    recommendedTool,
    reason,
    confidencePct,
    strategyNote,
    quantData: deepseekResult ?? undefined,
    trendData: grokResult ?? undefined,
  }
}

function hasSportsContent(text: string, hasImage: boolean): boolean {
  if (hasImage) return true
  const lower = text.toLowerCase()
  return SPORTS_KEYWORDS.some(kw => lower.includes(kw))
}

function detectNotificationTriggers(
  grokResult: GrokResult | null,
  quantResult: QuantResult | null
): string[] {
  const triggers: string[] = []

  if (grokResult?.injuryAlerts?.length) {
    triggers.push('injury_alert')
  }
  if (grokResult?.momentumFlags?.length) {
    triggers.push('momentum_shift')
  }
  if (quantResult?.playoffOdds != null && quantResult.playoffOdds < 30) {
    triggers.push('playoff_danger')
  }
  if (quantResult?.fairnessScore != null && quantResult.fairnessScore < 40) {
    triggers.push('lopsided_trade_warning')
  }

  return triggers
}

async function parseScreenshotWithVision(imageFile: File, userQuestion: string): Promise<string> {
  const arrayBuffer = await imageFile.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const openai = getVisionClient()
  if (!openai) {
    return JSON.stringify({
      error: 'Vision unavailable',
      players: [],
      context: 'No API key configured',
    })
  }

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Analyze this fantasy sports screenshot. Extract ALL of the following as JSON:
{
  "type": "trade|waiver|standings|draft|lineup|injury|box_score|social|other",
  "players": [{ "name": string, "team": string, "position": string, "side": "offer|receive|available|other" }],
  "tradeComponents": { "side_a": string[], "side_b": string[] },
  "standings": [{ "team": string, "record": string, "rank": number }],
  "draftPicks": [{ "round": number, "pick": number, "player": string }],
  "keyDetails": ["important visible details"],
  "initialTake": "short plain-English summary of what is visible"
}`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userQuestion || 'Analyze this screenshot and summarize what is visible.' },
            { type: 'image_url', image_url: { url: `data:${imageFile.type};base64,${base64}`, detail: 'high' } },
          ],
        },
      ],
    })

    return res.choices[0]?.message?.content ?? '{}'
  } catch (e: any) {
    console.error('[Chimmy] Vision error:', e?.message)
    return JSON.stringify({ error: e?.message, players: [] })
  }
}

async function getUserContext(userId?: string): Promise<string> {
  if (!userId) return 'No signed-in user context available.'
  try {
    const leagues = await (prisma as any).league.findMany({
      where: { userId },
      select: {
        name: true,
        sport: true,
        isDynasty: true,
        scoring: true,
        leagueSize: true,
        season: true,
        rosters: { select: { playerData: true }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    })

    if (!leagues.length) return 'User has no synced leagues yet.'

    const lines = leagues.map((l: any, idx: number) => {
      const roster = l.rosters?.[0]?.playerData
      const rosterPreview = Array.isArray(roster)
        ? roster.slice(0, 8).join(', ')
        : roster && typeof roster === 'object'
          ? Object.keys(roster).slice(0, 8).join(', ')
          : 'No roster players visible'

      return `${idx + 1}. ${l.name || 'Unnamed league'} (${l.sport}${l.isDynasty ? ', dynasty' : ''}${l.scoring ? `, ${l.scoring}` : ''}${l.leagueSize ? `, ${l.leagueSize} teams` : ''}${l.season ? `, ${l.season}` : ''}) | roster preview: ${rosterPreview}`
    })

    return lines.join('\n')
  } catch {
    return 'User league context unavailable right now.'
  }
}

async function getAIMemorySummary(userId: string): Promise<string> {
  try {
    const context = await getFullAIContext({ userId })
    const summary = buildMemoryPromptSection(context)
    return summary || ''
  } catch (e) {
    console.warn('[Chimmy] AI memory load failed:', e)
    return ''
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startMs = Date.now()

  const session = await getServerSession(authOptions as any)
  const userId = (session as any)?.user?.id ?? null

  let message = ''
  let imageFile: File | null = null
  let privateMode = false
  let targetUsername = ''
  let conversation: ConversationTurn[] = []
  let strategyMode: StrategyMode | undefined
  let sleeperUsername: string | undefined

  try {
    const formData = await req.formData()
    message        = ((formData.get('message') as string) ?? '').trim()
    privateMode    = formData.get('privateMode') === 'true'
    targetUsername  = ((formData.get('targetUsername') as string) ?? '').trim()
    sleeperUsername = ((formData.get('sleeperUsername') as string) ?? '').trim() || undefined

    const rawStrategy = (formData.get('strategyMode') as string) ?? ''
    if (rawStrategy && rawStrategy in STRATEGY_MODE_CONTEXT) {
      strategyMode = rawStrategy as StrategyMode
    }

    const rawHistory = formData.get('conversation') || formData.get('messages')
    if (rawHistory && typeof rawHistory === 'string') {
      try {
        const parsed = JSON.parse(rawHistory)
        if (Array.isArray(parsed)) conversation = parsed.slice(-10)
      } catch {}
    }

    const imgFile = formData.get('image') as File | null
    if (imgFile && imgFile.size > 0 && imgFile.type?.startsWith('image/')) {
      imageFile = imgFile
    }
  } catch (e) {
    console.error('[Chimmy] FormData parse error:', e)
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 })
  }

  if (!message && !imageFile) {
    return NextResponse.json({
      response: 'Ask me a fantasy sports question, share roster context, or upload a screenshot for analysis.',
    })
  }

  const domainInput = [message, ...conversation.map(c => c.content)].join(' ')
  if (!hasSportsContent(domainInput, !!imageFile)) {
    const offTopicResponse: ChimmyResponse = {
      answer: "Hey! I'm Chimmy — your fantasy sports co-manager. I'm built for fantasy leagues, trades, waivers, and all things sports. What's on your roster today?",
      recommendedTool: 'none',
      reason: 'Off-topic query',
      providers: { openai: 'skipped', grok: 'skipped', deepseek: 'skipped' },
      dataSources: [],
    }
    return NextResponse.json({ response: offTopicResponse.answer, meta: offTopicResponse })
  }

  const providers: ChimmyResponse['providers'] = {
    openai: 'skipped',
    grok: 'skipped',
    deepseek: 'skipped',
  }
  const dataSources: string[] = []

  let screenshotContext = ''
  if (imageFile) {
    try {
      screenshotContext = await parseScreenshotWithVision(imageFile, message)
      dataSources.push('screenshot_vision')
    } catch (e) {
      console.error('[Chimmy] Vision error:', e)
      screenshotContext = JSON.stringify({ error: 'Vision processing failed', players: [] })
    }
  }

  const [userContextResult, enrichmentResult, aiMemoryResult] = await Promise.allSettled([
    getUserContext(userId),
    enrichChatWithData(message || '', { sleeperUsername }).catch((err: any) => {
      console.warn('[Chimmy] Enrichment failed:', err)
      return null
    }),
    userId ? getAIMemorySummary(userId) : Promise.resolve(''),
  ])

  const userContextStr = userContextResult.status === 'fulfilled' ? userContextResult.value : ''
  const enrichment = enrichmentResult.status === 'fulfilled' ? enrichmentResult.value : null
  const enrichmentStr = enrichment?.context ?? ''
  const aiMemoryStr = aiMemoryResult.status === 'fulfilled' ? aiMemoryResult.value : ''

  if (enrichment?.sources) {
    const sourceSummary = buildDataSourcesSummary(enrichment.sources)
    dataSources.push(...sourceSummary)
  }

  const compiledPrompt = buildPrompt({
    question: message || 'Analyze this fantasy sports screenshot and advise what to do next.',
    conversation,
    userContext: userContextStr,
    screenshotContext,
    enrichmentData: enrichmentStr,
    privateMode,
    targetUsername,
    strategyMode,
    aiMemory: aiMemoryStr,
  })

  const [openaiResult, grokResult, deepseekResult] = await Promise.allSettled([
    (async (): Promise<string> => {
      try {
        const res = await openaiChatText({
          messages: [
            { role: 'system', content: buildDomainGuard(strategyMode) },
            { role: 'user', content: compiledPrompt },
          ],
          temperature: 0.4,
          maxTokens: 850,
        })
        if (res.ok) {
          providers.openai = 'ok'
          return res.text
        }
        providers.openai = 'error'
        console.error('[Chimmy] OpenAI error:', (res as any).details)
        return ''
      } catch (e: any) {
        providers.openai = 'error'
        console.error('[Chimmy] OpenAI error:', e?.message)
        return ''
      }
    })(),

    (async (): Promise<string> => {
      try {
        const res = await xaiChatJson({
          messages: [
            { role: 'system', content: buildGrokSystemPrompt() },
            { role: 'user', content: compiledPrompt },
          ],
          tools: [{ type: 'web_search', user_location_country: 'US' }],
          temperature: 0.35,
          maxTokens: 900,
        })
        if (res.ok) {
          providers.grok = 'ok'
          return parseTextFromXaiChatCompletion(res.json) ?? ''
        }
        providers.grok = 'error'
        console.error('[Chimmy] Grok error:', (res as any).details)
        return ''
      } catch (e: any) {
        providers.grok = 'error'
        console.error('[Chimmy] Grok error:', e?.message)
        return ''
      }
    })(),

    (async (): Promise<QuantResult | null> => {
      try {
        const result = await deepseekChat({
          prompt: compiledPrompt,
          systemPrompt: buildDeepSeekSystemPrompt(strategyMode),
          temperature: 0.1,
          maxTokens: 1200,
        })

        if (result.error || !result.content) {
          providers.deepseek = 'error'
          return { error: result.error ?? 'Empty response' }
        }

        providers.deepseek = 'ok'
        const parsed = parseJsonResponse(result.content)
        if (parsed) {
          return {
            projectionDelta: parsed.projectionDelta ?? null,
            expectedWeeklyGain: parsed.expectedWeeklyGain ?? null,
            winProbability: parsed.winProbability ?? null,
            playoffOdds: parsed.playoffOdds ?? null,
            fairnessScore: parsed.fairnessScore ?? null,
            riskGrade: parsed.riskGrade ?? null,
            confidencePct: parsed.confidencePct ?? null,
            ceilingScore: parsed.ceilingScore ?? null,
            floorScore: parsed.floorScore ?? null,
            varianceScore: parsed.varianceScore ?? null,
            simulationCount: parsed.simulationCount ?? null,
          }
        }
        return { error: 'JSON parse failed' }
      } catch (e: any) {
        providers.deepseek = 'error'
        console.error('[Chimmy] DeepSeek error:', e?.message)
        return null
      }
    })(),
  ])

  const openaiRaw = openaiResult.status === 'fulfilled' ? openaiResult.value : ''
  const grokRaw = grokResult.status === 'fulfilled' ? grokResult.value : ''
  const dsResult = deepseekResult.status === 'fulfilled' ? deepseekResult.value : null

  if (!openaiRaw && !grokRaw) {
    return NextResponse.json({
      response: "I couldn't complete that analysis right now. Re-ask your fantasy question, and if possible include league/roster details or re-upload the image.",
      meta: {
        assistant: 'Chimmy',
        providers,
        dataSources,
        processingMs: Date.now() - startMs,
      },
    })
  }

  const consensus = buildConsensus(openaiRaw, grokRaw, dsResult, strategyMode)

  const toolLink = consensus.recommendedTool !== 'none' ? TOOL_LINKS[consensus.recommendedTool] : null
  let finalAnswer = consensus.answer
  if (toolLink && consensus.recommendedTool !== 'none') {
    const toolLabel = consensus.recommendedTool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const why = consensus.reason ? `\n\nWhy: ${consensus.reason}` : ''
    finalAnswer += `\n\n\\u{1F449} [Open ${toolLabel}](${toolLink})${why}`
  }

  const triggers = detectNotificationTriggers(consensus.trendData ?? null, consensus.quantData ?? null)

  if (userId) {
    recordMemoryEvent({
      userId,
      eventType: 'chimmy_chat',
      subject: message.slice(0, 100),
      content: {
        tool: consensus.recommendedTool,
        confidence: consensus.confidencePct,
        strategy: strategyMode,
        triggers,
        providers: { ...providers },
      },
    }).catch(e => console.warn('[Chimmy] Memory record failed:', e))
  }

  const processingMs = Date.now() - startMs

  return NextResponse.json({
    response: finalAnswer,
    meta: {
      assistant: 'Chimmy',
      persona: 'feminine-friendly-direct',
      providerStatus: providers,
      recommendedTool: consensus.recommendedTool,
      confidencePct: consensus.confidencePct,
      strategyNote: consensus.strategyNote,
      quantData: consensus.quantData,
      trendData: consensus.trendData,
      hasImage: !!screenshotContext,
      privateMode,
      targetUsername: targetUsername || null,
      usedConversationTurns: conversation.length,
      dataSources: dataSources.length > 0 ? dataSources : undefined,
      enrichmentAudit: enrichment?.audit || undefined,
      triggers: triggers.length > 0 ? triggers : undefined,
      processingMs,
    },
  })
}
