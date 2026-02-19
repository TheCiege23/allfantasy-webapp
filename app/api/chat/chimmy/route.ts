import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { openaiChatText } from '@/lib/openai-client'
import { xaiChatJson, parseTextFromXaiChatCompletion } from '@/lib/xai-client'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type ToolKey = 'trade_analyzer' | 'trade_finder' | 'waiver_ai' | 'rankings' | 'mock_draft' | 'none'

type AssistantPayload = {
  answer: string
  recommendedTool: ToolKey
  reason?: string
}

const TOOL_LINKS: Record<Exclude<ToolKey, 'none'>, { label: string; href: string }> = {
  trade_analyzer: { label: 'Open Trade Evaluator', href: '/trade-evaluator' },
  trade_finder: { label: 'Open Trade Finder', href: '/trade-finder' },
  waiver_ai: { label: 'Open Waiver AI', href: '/waiver-ai' },
  rankings: { label: 'Open League Rankings', href: '/rankings' },
  mock_draft: { label: 'Open Mock Draft Simulator', href: '/mock-draft-simulator' },
}

const DOMAIN_GUARD = `You are Chimmy, AllFantasy's fantasy sports AI assistant.
Rules:
- Answer only fantasy sports and sports questions.
- If question is outside sports/fantasy sports (politics, religion, general life, finance, etc.), politely refuse and redirect to a fantasy sports topic.
- Be concise, practical, and up-to-date.
- If asked about a trade/waiver/rankings/draft decision, recommend one AllFantasy tool using key:
  trade_analyzer | trade_finder | waiver_ai | rankings | mock_draft | none
- Return JSON only:
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

function isSportsDomainPrompt(text: string): boolean {
  const q = text.toLowerCase()
  const sportsTerms = [
    'fantasy', 'trade', 'waiver', 'lineup', 'roster', 'draft', 'dynasty', 'redraft', 'ppr', 'superflex',
    'nfl', 'nba', 'mlb', 'player', 'adp', 'pick', 'rankings', 'league', 'sleeper', 'matchup',
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

  const visionResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Extract fantasy sports screenshot context. Return valid JSON only:
{
  "contextType": "trade|roster|draft|waiver|other",
  "leagueContext": "string",
  "entities": ["players/picks/teams visible"],
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
    max_tokens: 700,
  })

  return visionResponse.choices[0]?.message?.content || '{}'
}

async function getOpenAIAnswer(question: string, screenshotContext?: string): Promise<AssistantPayload | null> {
  const msg = screenshotContext
    ? `User question: ${question || 'Please analyze this screenshot.'}\n\nScreenshot context JSON:\n${screenshotContext}`
    : `User question: ${question}`

  const res = await openaiChatText({
    messages: [
      { role: 'system', content: DOMAIN_GUARD },
      { role: 'user', content: msg },
    ],
    temperature: 0.45,
    maxTokens: 700,
  })
  if (!res.ok) return null
  try {
    return normalizePayload(JSON.parse(res.text))
  } catch {
    return null
  }
}

async function getGrokAnswer(question: string, screenshotContext?: string): Promise<AssistantPayload | null> {
  const msg = screenshotContext
    ? `User question: ${question || 'Please analyze this screenshot.'}\n\nScreenshot context JSON:\n${screenshotContext}`
    : `User question: ${question}`

  const res = await xaiChatJson({
    messages: [
      { role: 'system', content: DOMAIN_GUARD },
      { role: 'user', content: msg },
    ],
    tools: [{ type: 'web_search' }],
    temperature: 0.3,
    maxTokens: 800,
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
      answer: `${openaiAns.answer}\n\nAlso worth noting: ${grokAns.answer}`,
      recommendedTool: openaiAns.recommendedTool !== 'none' ? openaiAns.recommendedTool : grokAns.recommendedTool,
      reason: openaiAns.reason || grokAns.reason,
    }
  }
  return openaiAns || grokAns
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const message = ((formData.get('message') as string) || '').trim()
    const imageFile = formData.get('image') as File | null

    if (!message && (!imageFile || imageFile.size <= 0)) {
      return NextResponse.json({ response: 'Ask me a fantasy sports question or upload a screenshot to review.' })
    }

    if (message && !isSportsDomainPrompt(message) && !imageFile) {
      return NextResponse.json({
        response:
          "I'm Chimmy and I can only help with sports + fantasy sports. Ask me about trades, waivers, rankings, drafts, or roster strategy.",
      })
    }

    let screenshotContext: string | undefined
    if (imageFile && imageFile.size > 0) {
      if (!imageFile.type.startsWith('image/')) {
        return NextResponse.json({ response: 'Please upload an image screenshot file.' }, { status: 400 })
      }
      screenshotContext = await parseScreenshotWithOpenAI(imageFile, message)
    }

    const [oa, gr] = await Promise.all([
      getOpenAIAnswer(message || 'Analyze this fantasy sports screenshot.', screenshotContext),
      getGrokAnswer(message || 'Analyze this fantasy sports screenshot.', screenshotContext),
    ])

    const final = consensus(oa, gr)
    if (!final) {
      return NextResponse.json({
        response: "I couldn't complete that analysis right now. Try again in a moment or re-upload the screenshot.",
      })
    }

    return NextResponse.json({
      response: attachToolLink(final),
      meta: {
        assistant: 'Chimmy',
        providerStatus: {
          openai: oa ? 'ok' : 'failed',
          grok: gr ? 'ok' : 'failed',
        },
        hasImage: !!screenshotContext,
      },
    })
  } catch (error) {
    console.error('[Chimmy Chat]', error)
    return NextResponse.json({
      response: "Sorry \u2014 I hit an issue analyzing that. Re-ask your fantasy sports question or upload the screenshot again.",
    })
  }
}
