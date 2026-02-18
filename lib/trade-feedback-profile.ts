import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { FEEDBACK_REASONS } from '@/lib/feedback-reasons'

const db = prisma as any

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PROFILE_STALE_HOURS = 6
const MIN_VOTES_FOR_PROFILE = 3

const REASON_TO_ENUM: Record<string, string> = Object.fromEntries(
  FEEDBACK_REASONS.map(r => [r.label, r.enum])
)

const ENUM_TO_LABEL: Record<string, string> = Object.fromEntries(
  FEEDBACK_REASONS.map(r => [r.enum, r.label])
)

interface FeedbackRecord {
  id: string
  userId: string
  tradeText: string | null
  suggestionTitle: string | null
  suggestionText: string | null
  vote: string
  reason: string | null
  leagueSize: number | null
  isDynasty: boolean | null
  scoring: string | null
  userRoster: string | null
  userContention: string | null
  createdAt: Date
}

export async function persistVote(params: {
  userId: string
  tradeText: string
  suggestionTitle: string
  suggestionText?: string
  vote: 'up' | 'down'
  reason?: string
  leagueSize?: number
  isDynasty?: boolean
  scoring?: string
  userRoster?: string
  userContention?: string
}) {
  const feedbackReason = params.reason ? (REASON_TO_ENUM[params.reason] || 'OTHER') : null

  const feedback = await db.feedback.create({
    data: {
      userId: params.userId,
      tradeText: params.tradeText.slice(0, 5000),
      suggestionTitle: params.suggestionTitle.slice(0, 200),
      suggestionText: params.suggestionText?.slice(0, 5000) || null,
      vote: params.vote === 'up' ? 'UP' : 'DOWN',
      reason: feedbackReason,
      leagueSize: params.leagueSize || null,
      isDynasty: params.isDynasty ?? null,
      scoring: params.scoring?.slice(0, 20) || null,
      userRoster: params.userRoster?.slice(0, 5000) || null,
      userContention: params.userContention?.slice(0, 20) || null,
    },
  })

  updateTradeProfileAsync(params.userId).catch((err: Error) =>
    console.error('[trade-feedback-profile] async profile update failed:', err)
  )

  return feedback
}

export interface TradeProfileResult {
  summary: string | null
  voteCount: number
  version: number
  lastUpdated: string | null
}

export async function getUserTradeProfile(userId: string): Promise<string | null> {
  const result = await getUserTradeProfileFull(userId)
  return result.summary
}

export async function getUserTradeProfileFull(userId: string): Promise<TradeProfileResult> {
  try {
    const profile = await db.tradeProfile.findUnique({
      where: { userId },
    })

    if (!profile?.summary) {
      return { summary: null, voteCount: 0, version: 0, lastUpdated: null }
    }

    if (profile.lastSummarizedAt) {
      const ageMs = Date.now() - new Date(profile.lastSummarizedAt).getTime()
      if (ageMs > PROFILE_STALE_HOURS * 60 * 60 * 1000) {
        updateTradeProfileAsync(userId).catch(() => {})
      }
    }

    return {
      summary: profile.summary as string,
      voteCount: profile.voteCount || 0,
      version: profile.version || 1,
      lastUpdated: profile.lastSummarizedAt ? new Date(profile.lastSummarizedAt).toISOString() : null,
    }
  } catch (err) {
    console.error('[trade-feedback-profile] getUserTradeProfile error:', err)
    return { summary: null, voteCount: 0, version: 0, lastUpdated: null }
  }
}

async function updateTradeProfileAsync(userId: string) {
  const votes: FeedbackRecord[] = await db.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  if (votes.length < MIN_VOTES_FOR_PROFILE) return

  const upCount = votes.filter((v: FeedbackRecord) => v.vote === 'UP').length
  const downCount = votes.filter((v: FeedbackRecord) => v.vote === 'DOWN').length

  const dynastyVotes = votes.filter((v: FeedbackRecord) => v.isDynasty === true)
  const redraftVotes = votes.filter((v: FeedbackRecord) => v.isDynasty === false)

  const voteLines = votes.map((v: FeedbackRecord) => {
    const icon = v.vote === 'UP' ? '👍' : '👎'
    const format = v.isDynasty ? 'dynasty' : v.isDynasty === false ? 'redraft' : 'unknown'
    const scoring = v.scoring || 'unknown'
    const size = v.leagueSize ? `${v.leagueSize}-team` : 'unknown size'
    const contention = v.userContention || 'unknown'
    const reasonLabel = v.reason ? (ENUM_TO_LABEL[v.reason] || v.reason) : null
    const reasonText = v.vote === 'DOWN' && reasonLabel ? ` — Reason: ${reasonLabel}` : ''
    return `${icon} "${v.suggestionTitle}" (${format}, ${scoring}, ${size}, ${contention})${reasonText}`
  }).join('\n')

  const reasonCounts: Record<string, number> = {}
  votes.filter((v: FeedbackRecord) => v.vote === 'DOWN' && v.reason).forEach((v: FeedbackRecord) => {
    const label = ENUM_TO_LABEL[v.reason!] || v.reason!
    reasonCounts[label] = (reasonCounts[label] || 0) + 1
  })
  const reasonBreakdown = Object.keys(reasonCounts).length > 0
    ? `Rejection reasons: ${Object.entries(reasonCounts).map(([r, c]) => `${r}(${c})`).join(', ')}`
    : null

  const contextStats = [
    `Total votes: ${votes.length} (${upCount} helpful, ${downCount} unhelpful)`,
    dynastyVotes.length > 0 ? `Dynasty votes: ${dynastyVotes.length} (${dynastyVotes.filter((v: FeedbackRecord) => v.vote === 'UP').length} up, ${dynastyVotes.filter((v: FeedbackRecord) => v.vote === 'DOWN').length} down)` : null,
    redraftVotes.length > 0 ? `Redraft votes: ${redraftVotes.length} (${redraftVotes.filter((v: FeedbackRecord) => v.vote === 'UP').length} up, ${redraftVotes.filter((v: FeedbackRecord) => v.vote === 'DOWN').length} down)` : null,
    reasonBreakdown,
  ].filter(Boolean).join('\n')

  try {
    const summaryRes = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a concise user preference summarizer for a fantasy football trade AI.
Turn these thumbs up/down votes on trade counter-offer suggestions into a short, dense profile of this user's:
- Valuation biases (do they think certain positions are over/undervalued?)
- Risk tolerance (do they prefer safe proven players or boom/bust upside?)
- Positional preferences (do they value QBs/RBs/WRs/TEs/picks differently?)
- Trade style (do they prefer small incremental improvements or blockbuster moves?)
- Format preferences (dynasty vs redraft tendencies)
- Contention awareness (how much do they weight win-now vs rebuild context?)

Be specific about what they liked and disliked. Reference concrete patterns from their votes.
Max 250 tokens. Focus on actionable patterns the AI can use to tailor future suggestions.
Do NOT include preamble or meta-commentary — just the profile.`,
        },
        {
          role: 'user',
          content: `${contextStats}\n\nVote history:\n${voteLines}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 300,
    })

    const summary = summaryRes.choices[0]?.message?.content?.trim() || ''
    if (!summary) return

    await db.tradeProfile.upsert({
      where: { userId },
      update: {
        summary,
        lastSummarizedAt: new Date(),
        voteCount: votes.length,
        version: { increment: 1 },
      },
      create: {
        userId,
        summary,
        lastSummarizedAt: new Date(),
        voteCount: votes.length,
        version: 1,
      },
    })
  } catch (err) {
    console.error('[trade-feedback-profile] GPT-4o-mini summarization failed:', err)
  }
}

export async function getRecentVotesForUser(userId: string, limit = 20): Promise<FeedbackRecord[]> {
  try {
    return await db.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  } catch {
    return []
  }
}
