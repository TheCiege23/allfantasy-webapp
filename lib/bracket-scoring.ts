import { prisma } from "./prisma"
import { normalizeTeamName, isPlaceholderTeam } from "./brackets/normalize"
import { pointsForRound } from "./brackets/scoring"

export type BracketScoringResult = {
  gamesFinalized: number
  picksScored: number
  teamsAdvanced: number
  teamNamesSeeded: number
  errors: string[]
}

function namesMatch(a: string, b: string): boolean {
  if (a === b) return true
  return normalizeTeamName(a) === normalizeTeamName(b)
}

function winnerFromGame(
  game: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number },
  node: { homeTeamName: string | null; awayTeamName: string | null }
): string | null {
  if (!node.homeTeamName || !node.awayTeamName) return null

  const gameWinner = game.homeScore > game.awayScore ? game.homeTeam : game.awayTeam

  if (namesMatch(gameWinner, node.homeTeamName)) return node.homeTeamName
  if (namesMatch(gameWinner, node.awayTeamName)) return node.awayTeamName
  return null
}

export async function scoreBracket(tournamentId: string): Promise<BracketScoringResult> {
  const errors: string[] = []
  let gamesFinalized = 0
  let picksScored = 0
  let teamsAdvanced = 0
  let teamNamesSeeded = 0

  const allTournamentNodes = await prisma.bracketNode.findMany({
    where: { tournamentId },
  })
  const nodeMap = new Map(allTournamentNodes.map((n) => [n.id, n]))

  const linkedNodes = allTournamentNodes.filter((n) => n.sportsGameId !== null)
  const linkedGameIds = linkedNodes.map((n) => n.sportsGameId).filter((id): id is string => id !== null)
  if (linkedGameIds.length === 0) return { gamesFinalized, picksScored, teamsAdvanced, teamNamesSeeded, errors }

  const games = await prisma.sportsGame.findMany({
    where: { id: { in: linkedGameIds } },
  })
  const gameMap = new Map(games.map((g) => [g.id, g]))

  for (const node of linkedNodes) {
    const game = node.sportsGameId ? gameMap.get(node.sportsGameId) : null
    if (!game) continue

    if (!node.homeTeamName || !node.awayTeamName) {
      const updates: Record<string, string> = {}
      if (!node.homeTeamName && game.homeTeam) updates.homeTeamName = game.homeTeam
      if (!node.awayTeamName && game.awayTeam) updates.awayTeamName = game.awayTeam

      if (Object.keys(updates).length > 0) {
        await prisma.bracketNode.update({
          where: { id: node.id },
          data: updates,
        })
        Object.assign(node, updates)
        nodeMap.set(node.id, node as any)
        teamNamesSeeded++
      }
    }

    const status = (game.status || "").toLowerCase()
    const isFinal = status === "final" || status === "ft" || status.includes("final")
    if (!isFinal) continue
    if (game.homeScore == null || game.awayScore == null) continue
    if (game.homeScore === game.awayScore) continue

    const winner = winnerFromGame(
      { homeTeam: game.homeTeam, awayTeam: game.awayTeam, homeScore: game.homeScore, awayScore: game.awayScore },
      node
    )
    if (!winner) {
      errors.push(`Node ${node.slot}: game final but could not resolve winner`)
      continue
    }

    gamesFinalized++
    const pts = pointsForRound(node.round)

    const correctResult = await prisma.bracketPick.updateMany({
      where: { nodeId: node.id, pickedTeamName: winner },
      data: { isCorrect: true, points: pts },
    })

    const incorrectResult = await prisma.bracketPick.updateMany({
      where: {
        nodeId: node.id,
        pickedTeamName: { not: null },
        NOT: { pickedTeamName: winner },
      },
      data: { isCorrect: false, points: 0 },
    })

    picksScored += correctResult.count + incorrectResult.count

    if (node.nextNodeId && node.nextNodeSide) {
      const nextNode = nodeMap.get(node.nextNodeId)
      if (!nextNode) {
        errors.push(`Node ${node.slot}: nextNodeId ${node.nextNodeId} not found`)
        continue
      }

      const currentVal =
        node.nextNodeSide === "HOME" ? nextNode.homeTeamName : nextNode.awayTeamName

      if (isPlaceholderTeam(currentVal)) {
        const updateData =
          node.nextNodeSide === "HOME"
            ? { homeTeamName: winner }
            : { awayTeamName: winner }

        await prisma.bracketNode.update({
          where: { id: node.nextNodeId },
          data: updateData,
        })

        const updatedNext = { ...nextNode, ...updateData }
        nodeMap.set(node.nextNodeId, updatedNext as any)
        teamsAdvanced++
      }
    }
  }

  return { gamesFinalized, picksScored, teamsAdvanced, teamNamesSeeded, errors }
}
