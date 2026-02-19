import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import BracketTree from "@/components/madness/BracketTree"
import Link from "next/link"

export default async function BracketViewPage({ params }: { params: { bracketId: string } }) {
  const session = (await getServerSession(authOptions as any)) as { user?: { id?: string } } | null
  if (!session?.user?.id) redirect("/login")

  const bracket = await (prisma as any).bracketEntry.findUnique({
    where: { id: params.bracketId },
    include: {
      picks: { select: { gameId: true, winnerTeam: true } },
      league: { select: { id: true, name: true } },
    },
  })

  if (!bracket || bracket.userId !== session.user.id) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-gray-400 text-lg">Bracket not found</p>
      </div>
    )
  }

  const tournament = await (prisma as any).bracketTournament.findFirst({
    where: { sport: "ncaam" },
    orderBy: { season: "desc" },
    select: { id: true },
  })

  const games = tournament
    ? await (prisma as any).marchMadnessGame.findMany({
        where: { tournamentId: tournament.id },
        orderBy: [{ round: "asc" }, { gameNumber: "asc" }],
      })
    : []

  const results = await (prisma as any).marchMadnessResult.findMany()
  const resultByGame = new Map<string, string>()
  for (const r of results) {
    resultByGame.set(r.gameId, r.winner)
  }

  const gamesWithWinners = games.map((g: any) => ({
    id: g.id,
    round: g.round,
    gameNumber: g.gameNumber,
    team1: g.team1,
    team1Seed: g.team1Seed,
    team2: g.team2,
    team2Seed: g.team2Seed,
    winner: resultByGame.get(g.id) || undefined,
  }))

  const picks = bracket.picks.reduce(
    (acc: Record<string, string>, p: any) => ({ ...acc, [p.gameId]: p.winnerTeam }),
    {}
  )

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            {bracket.name}
          </h1>
          {bracket.league && (
            <Link
              href={`/madness/leagues/${bracket.league.id}/leaderboard`}
              className="text-gray-400 hover:text-cyan-400 transition-colors text-sm mt-2 inline-block"
            >
              {bracket.league.name} &rarr; Leaderboard
            </Link>
          )}
        </div>

        <BracketTree picks={picks} games={gamesWithWinners} />
      </div>
    </div>
  )
}
