import { prisma } from "@/lib/prisma"

export type BracketNodeWithGame = {
  id: string
  slot: string
  round: number
  region: string | null
  seedHome: number | null
  seedAway: number | null
  homeTeamName: string | null
  awayTeamName: string | null
  sportsGameId: string | null
  nextNodeId: string | null
  nextNodeSide: string | null
  game: {
    id: string
    homeTeam: string
    awayTeam: string
    homeScore: number | null
    awayScore: number | null
    status: string | null
    startTime: string | null
  } | null
}

export async function getEntryBracketData(tournamentId: string, entryId: string) {
  const nodes = await prisma.bracketNode.findMany({
    where: { tournamentId },
    orderBy: [{ round: "asc" }, { region: "asc" }, { slot: "asc" }],
  })

  const gameIds = nodes.map((n) => n.sportsGameId).filter(Boolean) as string[]
  const games =
    gameIds.length > 0
      ? await prisma.sportsGame.findMany({
          where: { id: { in: gameIds } },
          select: {
            id: true,
            homeTeam: true,
            awayTeam: true,
            homeScore: true,
            awayScore: true,
            status: true,
            startTime: true,
          },
        })
      : []
  const gameById = Object.fromEntries(games.map((g) => [g.id, g]))

  const picks = await prisma.bracketPick.findMany({
    where: { entryId },
    select: { nodeId: true, pickedTeamName: true },
  })

  const pickMap: Record<string, string | null> = {}
  for (const p of picks) pickMap[p.nodeId] = p.pickedTeamName ?? null

  const nodesWithGame: BracketNodeWithGame[] = nodes.map((n) => ({
    id: n.id,
    slot: n.slot,
    round: n.round,
    region: n.region,
    seedHome: n.seedHome,
    seedAway: n.seedAway,
    homeTeamName: n.homeTeamName,
    awayTeamName: n.awayTeamName,
    sportsGameId: n.sportsGameId,
    nextNodeId: n.nextNodeId,
    nextNodeSide: n.nextNodeSide,
    game: n.sportsGameId && gameById[n.sportsGameId]
      ? {
          ...gameById[n.sportsGameId],
          startTime: gameById[n.sportsGameId].startTime?.toISOString() ?? null,
        }
      : null,
  }))

  return { nodesWithGame, pickMap }
}
