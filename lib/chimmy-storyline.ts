import { prisma } from '@/lib/prisma'
import { openaiChatText } from '@/lib/openai-client'

const CHIMMY_BOT_ID = 'chimmy-bot-00000000'
const CHIMMY_USERNAME = 'chimmy-bot'
const CHIMMY_DISPLAY = 'Chimmy'
const CHIMMY_AVATAR = '/chimmy-avatar.png'

export async function ensureChimmyBot(): Promise<string> {
  const existing = await prisma.appUser.findUnique({ where: { id: CHIMMY_BOT_ID } })
  if (existing) return CHIMMY_BOT_ID

  const usernameExists = await prisma.appUser.findUnique({ where: { username: CHIMMY_USERNAME } })
  if (usernameExists) return usernameExists.id

  await prisma.appUser.create({
    data: {
      id: CHIMMY_BOT_ID,
      email: 'chimmy-bot@allfantasy.internal',
      username: CHIMMY_USERNAME,
      displayName: CHIMMY_DISPLAY,
      avatarUrl: CHIMMY_AVATAR,
      passwordHash: 'BOT_ACCOUNT_NO_LOGIN',
    },
  })

  return CHIMMY_BOT_ID
}

export function getChimmyBotId(): string {
  return CHIMMY_BOT_ID
}

type GameResult = {
  team1: string
  team2: string
  winnerId: string
  team1Seed: number | null
  team2Seed: number | null
  round: number
  region: string | null
}

function isUpset(result: GameResult): boolean {
  if (!result.team1Seed || !result.team2Seed) return false
  const winnerSeed = result.winnerId === result.team1 ? result.team1Seed : result.team2Seed
  const loserSeed = result.winnerId === result.team1 ? result.team2Seed : result.team1Seed
  return winnerSeed > loserSeed && (winnerSeed - loserSeed) >= 4
}

function roundName(round: number): string {
  switch (round) {
    case 1: return 'Round of 64'
    case 2: return 'Round of 32'
    case 3: return 'Sweet 16'
    case 4: return 'Elite 8'
    case 5: return 'Final Four'
    case 6: return 'Championship'
    default: return `Round ${round}`
  }
}

export async function generateChimmyStoryline(
  leagueId: string,
  results: GameResult[]
): Promise<string | null> {
  const upsets = results.filter(isUpset)
  const lateRounds = results.filter(r => r.round >= 3)
  const bigEvents = [...upsets, ...lateRounds]

  if (bigEvents.length === 0 && results.length < 3) return null

  const eventsToHighlight = bigEvents.length > 0 ? bigEvents : results.slice(0, 5)

  const recentMessages = await prisma.madnessChatMessage.findMany({
    where: { leagueId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { displayName: true, username: true } },
    },
  })

  const chatContext = recentMessages
    .reverse()
    .map(m => {
      const name = m.user.displayName || m.user.username
      return `${name}: ${m.message}`
    })
    .join('\n')

  const eventDescriptions = eventsToHighlight.map(e => {
    const winner = e.winnerId
    const loser = e.winnerId === e.team1 ? e.team2 : e.team1
    const winnerSeed = e.winnerId === e.team1 ? e.team1Seed : e.team2Seed
    const loserSeed = e.winnerId === e.team1 ? e.team2Seed : e.team1Seed
    const upset = isUpset(e)
    const seedInfo = winnerSeed && loserSeed ? ` (#${winnerSeed} over #${loserSeed})` : ''
    return `${roundName(e.round)}: ${winner} beat ${loser}${seedInfo}${upset ? ' - UPSET!' : ''}`
  }).join('\n')

  const prompt = `Recent game results:\n${eventDescriptions}\n\n${chatContext ? `Recent league chat:\n${chatContext}\n\n` : ''}You are Chimmy, the fun AI storyteller for this March Madness bracket league. Create a short, entertaining 2-4 sentence narrative recap or storyline based on these events${chatContext ? ' and the community\'s chat energy' : ''}. Keep it light, funny, and engaging. Reference specific teams and upsets. End with a question to the league to keep chat going. Do NOT start with "Chimmy says" or use your name.`

  const result = await openaiChatText({
    messages: [
      {
        role: 'system',
        content: 'You are Chimmy, a fun, energetic AI storyteller for a March Madness bracket league. You love chaos, upsets, and keeping the banter going. Use basketball terminology and March Madness references. Keep responses concise (2-4 sentences). Use 1-2 emojis max.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.9,
    maxTokens: 300,
  })

  if (!result.ok) {
    console.error('[Chimmy Storyline] OpenAI error:', result.details)
    return null
  }

  return result.text
}

export async function postChimmyStoryline(
  leagueId: string,
  storyline: string
): Promise<void> {
  const botId = await ensureChimmyBot()

  const isMember = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: botId } },
  })

  if (!isMember) {
    await prisma.bracketLeagueMember.create({
      data: { leagueId, userId: botId, role: 'member' },
    })
  }

  await prisma.madnessChatMessage.create({
    data: {
      leagueId,
      userId: botId,
      message: storyline,
    },
  })
}

export async function triggerChimmyForLeague(
  leagueId: string,
  results: GameResult[]
): Promise<{ posted: boolean; storyline?: string }> {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const recentChimmyPost = await prisma.madnessChatMessage.findFirst({
      where: {
        leagueId,
        userId: CHIMMY_BOT_ID,
        createdAt: { gte: thirtyMinAgo },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recentChimmyPost) {
      console.log(`[Chimmy] Skipping league ${leagueId} — posted ${Math.round((Date.now() - recentChimmyPost.createdAt.getTime()) / 60000)}min ago`)
      return { posted: false }
    }

    const storyline = await generateChimmyStoryline(leagueId, results)
    if (!storyline) return { posted: false }

    await postChimmyStoryline(leagueId, storyline)
    return { posted: true, storyline }
  } catch (err) {
    console.error('[Chimmy] Error generating storyline for league', leagueId, err)
    return { posted: false }
  }
}

export async function triggerChimmyForAllLeagues(
  results: GameResult[]
): Promise<{ leaguesNotified: number }> {
  if (results.length === 0) return { leaguesNotified: 0 }

  const leagues = await prisma.bracketLeague.findMany({
    select: { id: true },
  })

  let notified = 0
  for (const league of leagues) {
    const { posted } = await triggerChimmyForLeague(league.id, results)
    if (posted) notified++
  }

  return { leaguesNotified: notified }
}
