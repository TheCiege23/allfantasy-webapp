import { prisma } from "@/lib/prisma"

export type SystemMessageType =
  | "UPSET_ALERT"
  | "BRACKET_BUSTED"
  | "BIG_SWING"
  | "LEAD_CHANGE"
  | "TOURNAMENT_READY"
  | "BRACKET_LOCKED"

const SYSTEM_USER_ID = "SYSTEM"

export async function postSystemMessage(
  leagueId: string,
  type: SystemMessageType,
  content: string
) {
  try {
    const systemUser = await prisma.appUser.findFirst({
      where: { email: "system@fancred.brackets" },
      select: { id: true },
    })

    const userId = systemUser?.id || SYSTEM_USER_ID

    const payload = JSON.stringify({ type, content, isSystem: true })

    await (prisma as any).bracketLeagueMessage.create({
      data: {
        leagueId,
        userId,
        message: payload,
      },
    })
  } catch (err) {
    console.error(`[ChatSystem] Failed to post ${type} to league ${leagueId}:`, err)
  }
}

export async function broadcastUpsetAlert(
  leagueId: string,
  winner: string,
  winnerSeed: number,
  loser: string,
  loserSeed: number,
  round: number
) {
  const roundNames: Record<number, string> = {
    1: "Round of 64",
    2: "Round of 32",
    3: "Sweet 16",
    4: "Elite 8",
    5: "Final Four",
    6: "Championship",
  }
  const roundName = roundNames[round] || `Round ${round}`

  await postSystemMessage(
    leagueId,
    "UPSET_ALERT",
    `UPSET ALERT! #${winnerSeed} ${winner} knocks off #${loserSeed} ${loser} in the ${roundName}!`
  )
}

export async function broadcastBracketBusted(
  leagueId: string,
  entryName: string,
  eliminatedChampion: string
) {
  await postSystemMessage(
    leagueId,
    "BRACKET_BUSTED",
    `Bracket busted! ${entryName}'s champion pick ${eliminatedChampion} has been eliminated.`
  )
}

export async function broadcastBigSwingGame(
  leagueId: string,
  winner: string,
  pctAffected: number
) {
  await postSystemMessage(
    leagueId,
    "BIG_SWING",
    `Big swing game! ${winner}'s win affected ${pctAffected}% of brackets in this league.`
  )
}

export async function broadcastLeadChange(
  leagueId: string,
  newLeader: string,
  points: number
) {
  await postSystemMessage(
    leagueId,
    "LEAD_CHANGE",
    `Lead change! ${newLeader} takes the lead with ${points} points!`
  )
}

export async function broadcastTournamentReady(leagueId: string) {
  await postSystemMessage(
    leagueId,
    "TOURNAMENT_READY",
    `The tournament bracket is set! Create your bracket now before tip-off.`
  )
}
