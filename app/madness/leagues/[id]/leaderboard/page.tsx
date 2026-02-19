import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import LiveLeaderboard from "@/components/madness/LiveLeaderboard"
import LiveGameChat from "@/components/madness/LiveGameChat"

function pointsForRound(round: number): number {
  switch (round) {
    case 1: return 1
    case 2: return 2
    case 3: return 4
    case 4: return 8
    case 5: return 16
    case 6: return 32
    default: return 0
  }
}

export default async function LeagueLeaderboardPage({ params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions as any)) as { user?: { id?: string } } | null
  if (!session?.user?.id) redirect("/login")

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  })

  if (!league) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-gray-400 text-lg">League not found</p>
      </div>
    )
  }

  const entries = await (prisma as any).bracketEntry.findMany({
    where: { leagueId: params.id },
    include: {
      user: { select: { displayName: true, username: true, email: true, avatarUrl: true } },
      picks: { select: { gameId: true, winnerTeam: true } },
    },
  })

  const results = await (prisma as any).marchMadnessResult.findMany()
  const resultByGame = new Map<string, { winner: string; round: number }>()
  for (const r of results) {
    resultByGame.set(r.gameId, { winner: r.winner, round: r.round })
  }

  const leaderboard = entries
    .map((entry: any) => {
      let score = 0
      for (const pick of entry.picks) {
        const result = resultByGame.get(pick.gameId)
        if (result && pick.winnerTeam === result.winner) {
          score += pointsForRound(result.round)
        }
      }
      return {
        bracketId: entry.id,
        name: entry.name,
        user: entry.user?.displayName || entry.user?.username || entry.user?.email || "Unknown",
        score,
        avatar: entry.user?.avatarUrl || undefined,
      }
    })
    .sort((a: any, b: any) => b.score - a.score)

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-4xl font-bold text-center mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          {league.name} Leaderboard
        </h1>
        <p className="text-center text-gray-400 mb-12">Live scoring &bull; Updated every minute</p>

        <LiveLeaderboard initialLeaderboard={leaderboard} leagueId={league.id} />
      </div>

      <LiveGameChat leagueId={league.id} currentUserId={session.user.id!} />
    </div>
  )
}
