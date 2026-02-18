import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const db = prisma as any

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PROFILE_STALE_HOURS = 6
const MIN_VOTES_FOR_PROFILE = 3

interface VoteRecord {
  id: string
  userId: string
  tradeText: string
  suggestionTitle: string
  suggestionText: string | null
  vote: string
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
  leagueSize?: number
  isDynasty?: boolean
  scoring?: string
  userRoster?: string
  userContention?: string
}) {
  const vote = await db.tradeSuggestionVote.create({
    data: {
      userId: params.userId,
      tradeText: params.tradeText.slice(0, 5000),
      suggestionTitle: params.suggestionTitle.slice(0, 200),
      suggestionText: params.suggestionText?.slice(0, 5000) || null,
      vote: params.vote,
      leagueSize: params.leagueSize || null,
      isDynasty: params.isDynasty ?? null,
      scoring: params.scoring?.slice(0, 20) || null,
      userRoster: params.userRoster?.slice(0, 5000) || null,
      userContention: params.userContention?.slice(0, 20) || null,
    },
  })

  updateUserProfileAsync(params.userId).catch((err: Error) =>
    console.error('[trade-feedback-profile] async profile update failed:', err)
  )

  return vote
}

export async function getUserTradeProfile(userId: string): Promise<string | null> {
  try {
    const profile = await db.aIUserProfile.findUnique({
      where: { userId },
      select: { tradePreferenceProfile: true, tradeProfileUpdatedAt: true },
    })

    if (!profile?.tradePreferenceProfile) return null

    if (profile.tradeProfileUpdatedAt) {
      const ageMs = Date.now() - new Date(profile.tradeProfileUpdatedAt).getTime()
      if (ageMs > PROFILE_STALE_HOURS * 60 * 60 * 1000) {
        updateUserProfileAsync(userId).catch(() => {})
      }
    }

    return profile.tradePreferenceProfile as string
  } catch (err) {
    console.error('[trade-feedback-profile] getUserTradeProfile error:', err)
    return null
  }
}

async function updateUserProfileAsync(userId: string) {
  const votes: VoteRecord[] = await db.tradeSuggestionVote.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  if (votes.length < MIN_VOTES_FOR_PROFILE) return

  const upCount = votes.filter((v: VoteRecord) => v.vote === 'up').length
  const downCount = votes.filter((v: VoteRecord) => v.vote === 'down').length

  const dynastyVotes = votes.filter((v: VoteRecord) => v.isDynasty === true)
  const redraftVotes = votes.filter((v: VoteRecord) => v.isDynasty === false)

  const voteLines = votes.map((v: VoteRecord) => {
    const icon = v.vote === 'up' ? '👍' : '👎'
    const format = v.isDynasty ? 'dynasty' : v.isDynasty === false ? 'redraft' : 'unknown'
    const scoring = v.scoring || 'unknown'
    const size = v.leagueSize ? `${v.leagueSize}-team` : 'unknown size'
    const contention = v.userContention || 'unknown'
    return `${icon} "${v.suggestionTitle}" (${format}, ${scoring}, ${size}, ${contention})`
  }).join('\n')

  const contextStats = [
    `Total votes: ${votes.length} (${upCount} helpful, ${downCount} unhelpful)`,
    dynastyVotes.length > 0 ? `Dynasty votes: ${dynastyVotes.length} (${dynastyVotes.filter((v: VoteRecord) => v.vote === 'up').length} up, ${dynastyVotes.filter((v: VoteRecord) => v.vote === 'down').length} down)` : null,
    redraftVotes.length > 0 ? `Redraft votes: ${redraftVotes.length} (${redraftVotes.filter((v: VoteRecord) => v.vote === 'up').length} up, ${redraftVotes.filter((v: VoteRecord) => v.vote === 'down').length} down)` : null,
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

    await db.aIUserProfile.upsert({
      where: { userId },
      update: {
        tradePreferenceProfile: summary,
        tradeProfileUpdatedAt: new Date(),
      },
      create: {
        userId,
        tradePreferenceProfile: summary,
        tradeProfileUpdatedAt: new Date(),
      },
    })
  } catch (err) {
    console.error('[trade-feedback-profile] GPT-4o-mini summarization failed:', err)
  }
}

export async function getRecentVotesForUser(userId: string, limit = 20): Promise<VoteRecord[]> {
  try {
    return await db.tradeSuggestionVote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  } catch {
    return []
  }
}
