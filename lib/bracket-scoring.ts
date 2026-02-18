import { prisma } from "./prisma"

const ROUND_POINTS: Record<number, number> = {
  0: 1,
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
  6: 32,
}

export type BracketScoringResult = {
  gamesFinalized: number
  picksScored: number
  teamsAdvanced: number
  teamNamesSeeded: number
  errors: string[]
}

function normalizeForCompare(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/^THE\s+/i, "")
    .replace(/\bUNIVERSITY\b|\bUNIV\.?\b|\bCOLLEGE\b|\bOF\b/gi, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function namesMatch(a: string, b: string): boolean {
  if (a === b) return true
  const na = normalizeForCompare(a)
  const nb = normalizeForCompare(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  return false
}

function mapGameTeamToNodeSide(
  gameTeam: string,
  node: { homeTeamName: string | null; awayTeamName: string | null }
): "HOME" | "AWAY" | null {
  const homeMatch = node.homeTeamName && namesMatch(gameTeam, node.homeTeamName)
  const awayMatch = node.awayTeamName && namesMatch(gameTeam, node.awayTeamName)
  if (homeMatch && !awayMatch) return "HOME"
  if (awayMatch && !homeMatch) return "AWAY"
  return null
}

function resolveWinner(
  game: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number },
  node: { homeTeamName: string | null; awayTeamName: string | null }
): { winnerName: string; side: "HOME" | "AWAY" } | null {
  if (!node.homeTeamName || !node.awayTeamName) return null

  const gameWinnerTeam = game.homeScore > game.awayScore ? game.homeTeam : game.awayTeam

  const winnerSide = mapGameTeamToNodeSide(gameWinnerTeam, node)
  if (!winnerSide) return null

  return {
    winnerName: winnerSide === "HOME" ? node.homeTeamName : node.awayTeamName,
    side: winnerSide,
  }
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

    if (game.status !== "final") continue
    if (game.homeScore == null || game.awayScore == null) continue
    if (game.homeScore === game.awayScore) continue

    const result = resolveWinner(
      { homeTeam: game.homeTeam, awayTeam: game.awayTeam, homeScore: game.homeScore, awayScore: game.awayScore },
      node
    )
    if (!result) {
      errors.push(`Node ${node.slot}: game final but could not resolve winner`)
      continue
    }

    gamesFinalized++

    const roundPoints = ROUND_POINTS[node.round] ?? 1

    const picks = await prisma.bracketPick.findMany({
      where: { nodeId: node.id, isCorrect: null },
    })

    for (const pick of picks) {
      const correct = pick.pickedTeamName === result.winnerName
      await prisma.bracketPick.update({
        where: { id: pick.id },
        data: {
          isCorrect: correct,
          points: correct ? roundPoints : 0,
        },
      })
      picksScored++
    }

    if (node.nextNodeId && node.nextNodeSide) {
      const nextNode = nodeMap.get(node.nextNodeId)
      if (!nextNode) {
        errors.push(`Node ${node.slot}: nextNodeId ${node.nextNodeId} not found`)
        continue
      }

      const alreadySet =
        node.nextNodeSide === "HOME" ? nextNode.homeTeamName : nextNode.awayTeamName

      if (!alreadySet) {
        const updateData =
          node.nextNodeSide === "HOME"
            ? { homeTeamName: result.winnerName }
            : { awayTeamName: result.winnerName }

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
