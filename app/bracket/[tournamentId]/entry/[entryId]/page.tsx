import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BracketView } from "@/components/bracket/BracketView"

export default async function EntryBracketPage({
  params,
}: {
  params: { tournamentId: string; entryId: string }
}) {
  const session = await getServerSession(authOptions as any)
  if (!session?.user?.id)
    return (
      <div className="p-6 text-gray-600 dark:text-gray-400">
        Please log in to view your bracket.
      </div>
    )

  const entry = await prisma.bracketEntry.findUnique({
    where: { id: params.entryId },
    select: { id: true, userId: true, leagueId: true, name: true },
  })

  if (!entry || entry.userId !== session.user.id)
    return (
      <div className="p-6 text-gray-600 dark:text-gray-400">
        Bracket entry not found.
      </div>
    )

  const nodes = await prisma.bracketNode.findMany({
    where: { tournamentId: params.tournamentId },
    orderBy: [{ round: "asc" }, { region: "asc" }, { slot: "asc" }],
  })

  const gameIds = nodes
    .map((n) => n.sportsGameId)
    .filter(Boolean) as string[]

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
    where: { entryId: entry.id },
    select: { nodeId: true, pickedTeamName: true },
  })

  const pickMap: Record<string, string | null> = {}
  for (const p of picks) pickMap[p.nodeId] = p.pickedTeamName ?? null

  const nodesWithGame = nodes.map((n) => ({
    ...n,
    game: n.sportsGameId ? gameById[n.sportsGameId] ?? null : null,
  }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold dark:text-gray-100">
          {entry.name || "My Bracket"}
        </h1>
        <a
          href={`/api/bracket/leagues/${entry.leagueId}/standings`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View Standings
        </a>
      </div>
      <BracketView
        nodes={nodesWithGame as any}
        entryId={entry.id}
        picks={pickMap}
      />
    </div>
  )
}
