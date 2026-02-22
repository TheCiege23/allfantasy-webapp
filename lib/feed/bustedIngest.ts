import { prisma } from "@/lib/prisma"
import {
  evaluateBracketsBustedEvents,
  type GameFinalContext,
  type LeagueImpactContext,
  type SpamControl,
  DEFAULT_SPAM,
} from "@/lib/feed/bustedRules"

export async function onGameFinalCreateBustedEvents(args: {
  game: GameFinalContext
  leagueImpacts: LeagueImpactContext[]
  spam?: Partial<SpamControl>
}) {
  const { game, leagueImpacts, spam } = args
  const mergedSpam: SpamControl = { ...DEFAULT_SPAM, ...(spam ?? {}) }
  const created: { id: string; type: string; scope: string }[] = []

  for (const impact of leagueImpacts) {
    const existing = await (prisma as any).bracketFeedEvent.findFirst({
      where: {
        tournamentId: game.tournamentId,
        metadata: { path: ["gameId"], equals: game.gameId },
        ...(impact.leagueId ? { leagueId: impact.leagueId } : { leagueId: null }),
      },
    })

    if (existing) continue

    const drafts = evaluateBracketsBustedEvents(game, impact, mergedSpam)

    for (const d of drafts) {
      const event = await (prisma as any).bracketFeedEvent.create({
        data: {
          tournamentId: game.tournamentId,
          leagueId: impact.leagueId ?? null,
          eventType: d.type,
          headline: d.title,
          detail: d.message,
          metadata: {
            gameId: d.gameId ?? game.gameId,
            impactPct: d.impactPct ?? null,
            round: game.round,
            seedWinner: game.seedWinner,
            seedLoser: game.seedLoser,
            underdogWon: game.underdogWon,
            scope: impact.scope,
          },
        },
      })

      created.push({ id: event.id, type: d.type, scope: impact.scope })
    }
  }

  return { created, count: created.length }
}
