import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { openaiChatText } from '@/lib/openai-client'
import { xaiChatJson, parseTextFromXaiChatCompletion } from '@/lib/xai-client'

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    return new OpenAI({ apiKey: key })
  } catch {
    return null
  }
}

type ToolKey = 'trade_analyzer' | 'trade_finder' | 'waiver_ai' | 'rankings' | 'mock_draft' | 'none'

type AssistantPayload = {
  answer: string
  recommendedTool: ToolKey
  reason?: string
}

type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
}

const TOOL_LINKS: Record<Exclude<ToolKey, 'none'>, { label: string; href: string }> = {
  trade_analyzer: { label: 'Open Trade Evaluator', href: '/trade-evaluator' },
  trade_finder: { label: 'Open Trade Finder', href: '/trade-finder' },
  waiver_ai: { label: 'Open Waiver AI', href: '/waiver-ai' },
  rankings: { label: 'Open League Rankings', href: '/rankings' },
  mock_draft: { label: 'Open Mock Draft Simulator', href: '/mock-draft-simulator' },
}

const DOMAIN_GUARD = `You are Chimmy, AllFantasy's signature AI assistant.
Persona and tone:
- Feminine, warm, supportive, and confident.
- Nice and encouraging, but direct/straightforward with results.
- Do not be vague; give actionable recommendations.

Scope:
- Answer only sports/fantasy sports topics.
- Prioritize fantasy football unless the user specifies another sport.
- Handle roster, trade, waiver, rankings, lineup, and league-specific decisions.
- Use provided user context (league/roster info + screenshot analysis) when available.

Safety/quality:
- If question is outside sports/fantasy sports, politely refuse and redirect to fantasy sports.
- If data is incomplete, say what is missing and provide a best-effort answer.
- Be concise but complete enough for decision-making.

Product guidance:
- If asked about a trade/waiver/rankings/draft decision, recommend one AllFantasy tool key:
  trade_analyzer | trade_finder | waiver_ai | rankings | mock_draft | none

Return strict JSON only:
{
  "answer": "string",
  "recommendedTool": "trade_analyzer|trade_finder|waiver_ai|rankings|mock_draft|none",
  "reason": "short reason"
}`

function normalizePayload(raw: unknown): AssistantPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const answer = typeof obj.answer === 'string' ? obj.answer.trim() : ''
  const key = typeof obj.recommendedTool === 'string' ? obj.recommendedTool : 'none'
  const reason = typeof obj.reason === 'string' ? obj.reason.trim() : undefined
  if (!answer) return null
  const allowed: ToolKey[] = ['trade_analyzer', 'trade_finder', 'waiver_ai', 'rankings', 'mock_draft', 'none']
  return {
    answer,
    recommendedTool: (allowed.includes(key as ToolKey) ? key : 'none') as ToolKey,
    reason,
  }
}

function parseMessages(input: string | null): ChatMsg[] {
  if (!input) return []
  try {
    const parsed = JSON.parse(input)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((m): ChatMsg => ({
        role: m?.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: typeof m?.content === 'string' ? m.content.trim() : '',
      }))
      .filter((m) => m.content)
      .slice(-10)
  } catch {
    return []
  }
}

function isSportsDomainPrompt(text: string): boolean {
  const q = text.toLowerCase()
  const sportsTerms = [
    'fantasy', 'trade', 'waiver', 'waivers', 'lineup', 'roster', 'draft', 'dynasty', 'redraft', 'ppr', 'superflex',
    'nfl', 'nba', 'mlb', 'player', 'adp', 'pick', 'rankings', 'league', 'sleeper', 'matchup', 'bye week', 'injury',
  ]
  return sportsTerms.some((t) => q.includes(t))
}

function attachToolLink(payload: AssistantPayload): string {
  if (payload.recommendedTool === 'none') return payload.answer
  const tool = TOOL_LINKS[payload.recommendedTool]
  if (!tool) return payload.answer
  const why = payload.reason ? `\n\nWhy: ${payload.reason}` : ''
  return `${payload.answer}\n\n\u{1F449} [${tool.label}](${tool.href})${why}`
}

async function parseScreenshotWithOpenAI(imageFile: File, userQuestion: string): Promise<string> {
  const arrayBuffer = await imageFile.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const openai = getOpenAIClient()
  if (!openai) {
    return JSON.stringify({
      contextType: 'other',
      sport: 'unknown',
      leagueContext: 'Vision temporarily unavailable (missing OpenAI key)',
      entities: [],
      textVisible: [],
      keyDetails: [],
      initialTake: 'Image uploaded but visual extraction is currently unavailable.',
    })
  }

  const visionResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Analyze this fantasy sports screenshot and extract words + context. Return valid JSON only:
{
  "contextType": "trade|roster|draft|waiver|league|other",
  "sport": "NFL|NBA|MLB|unknown",
  "leagueContext": "string",
  "entities": ["players/picks/teams visible"],
  "textVisible": ["important words/numbers shown in image"],
  "keyDetails": ["important visible details"],
  "initialTake": "short plain-English summary"
}`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: userQuestion || 'Analyze this screenshot and summarize what is visible.' },
          { type: 'image_url', image_url: { url: `data:${imageFile.type};base64,${base64}` } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 900,
  })

  return visionResponse.choices[0]?.message?.content || '{}'
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

function buildPrompt({
  message,
  conversation,
  screenshotContext,
  userContext,
  privateMode,
  targetUsername,
}: {
  message: string
  conversation: ChatMsg[]
  screenshotContext?: string
  userContext?: string
  privateMode?: boolean
  targetUsername?: string
}) {
  const convo = conversation.length
    ? conversation.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
    : 'No prior conversation.'

  return [
    `User question: ${message || 'Analyze this fantasy sports screenshot.'}`,
    `Private mode: ${privateMode ? 'on' : 'off'}`,
    `Target username: ${targetUsername || 'none'}`,
    `Recent conversation:\n${convo}`,
    `User fantasy context:\n${userContext || 'none'}`,
    screenshotContext ? `Screenshot context JSON:\n${screenshotContext}` : 'Screenshot context JSON: none',
  ].join('\n\n')
}

async function getOpenAIAnswer(compiledPrompt: string): Promise<AssistantPayload | null> {
  const res = await openaiChatText({
    messages: [
      { role: 'system', content: DOMAIN_GUARD },
      { role: 'user', content: compiledPrompt },
    ],
    temperature: 0.4,
    maxTokens: 850,
  })
  if (!res.ok) return null
  try {
    return normalizePayload(JSON.parse(res.text))
  } catch {
    return null
  }
}

async function getGrokAnswer(compiledPrompt: string): Promise<AssistantPayload | null> {
  const res = await xaiChatJson({
    messages: [
      { role: 'system', content: DOMAIN_GUARD },
      { role: 'user', content: compiledPrompt },
    ],
    tools: [{ type: 'web_search', user_location_country: 'US' }],
    temperature: 0.35,
    maxTokens: 900,
  })

  if (!res.ok) return null
  const text = parseTextFromXaiChatCompletion(res.json)
  if (!text) return null
  try {
    return normalizePayload(JSON.parse(text))
  } catch {
    return null
  }
}

function consensus(openaiAns: AssistantPayload | null, grokAns: AssistantPayload | null): AssistantPayload | null {
  if (openaiAns && grokAns) {
    return {
      answer: `${openaiAns.answer}\n\nQuick second look: ${grokAns.answer}`,
      recommendedTool: openaiAns.recommendedTool !== 'none' ? openaiAns.recommendedTool : grokAns.recommendedTool,
      reason: openaiAns.reason || grokAns.reason,
    }
  }
  return openaiAns || grokAns
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any)
    const userId = (session as any)?.user?.id as string | undefined

    const formData = await req.formData()
    const message = ((formData.get('message') as string) || '').trim()
    const imageFile = formData.get('image') as File | null
    const privateMode = String(formData.get('privateMode') || '').toLowerCase() === 'true'
    const targetUsername = ((formData.get('targetUsername') as string) || '').trim()
    const conversation = parseMessages((formData.get('messages') as string) || null)

    if (!message && (!imageFile || imageFile.size <= 0)) {
      return NextResponse.json({ response: 'Ask me a fantasy sports question, share roster context, or upload a screenshot for analysis.' })
    }

    const domainInput = [message, ...conversation.map((c) => c.content)].join(' ')
    if (domainInput && !isSportsDomainPrompt(domainInput) && !imageFile) {
      return NextResponse.json({
        response:
          "I'm Chimmy \u{1F496} and I only cover sports + fantasy sports. Ask me about your roster, trades, waivers, rankings, drafts, or league strategy.",
      })
    }

    let screenshotContext: string | undefined
    if (imageFile && imageFile.size > 0) {
      if (!imageFile.type.startsWith('image/')) {
        return NextResponse.json({ response: 'Please upload an image screenshot file.' }, { status: 400 })
      }
      screenshotContext = await parseScreenshotWithOpenAI(imageFile, message)
    }

    const userContext = await getUserContext(userId)

    const compiledPrompt = buildPrompt({
      message: message || 'Analyze this fantasy sports screenshot and advise what to do next.',
      conversation,
      screenshotContext,
      userContext,
      privateMode,
      targetUsername,
    })

    const [oa, gr] = await Promise.all([
      getOpenAIAnswer(compiledPrompt),
      getGrokAnswer(compiledPrompt),
    ])

    const final = consensus(oa, gr)
    if (!final) {
      return NextResponse.json({
        response: "I couldn't complete that analysis right now. Re-ask your fantasy question, and if possible include league/roster details or re-upload the image.",
      })
    }

    return NextResponse.json({
      response: attachToolLink(final),
      meta: {
        assistant: 'Chimmy',
        persona: 'feminine-friendly-direct',
        providerStatus: {
          openai: oa ? 'ok' : 'failed',
          grok: gr ? 'ok' : 'failed',
        },
        hasImage: !!screenshotContext,
        privateMode,
        targetUsername: targetUsername || null,
        usedConversationTurns: conversation.length,
      },
    })
  } catch (error) {
    console.error('[Chimmy Chat]', error)
    return NextResponse.json({
      response: 'Sorry \u2014 I hit an issue analyzing that. Re-ask your fantasy sports question, roster concern, trade, waiver, or upload the screenshot again.',
    })
  }
}
