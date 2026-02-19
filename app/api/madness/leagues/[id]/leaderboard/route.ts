import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const entries = await (prisma as any).bracketEntry.findMany({
    where: { leagueId: params.id },
    include: {
      user: { select: { displayName: true, email: true, username: true, avatarUrl: true } },
      picks: { select: { gameId: true, winnerTeam: true } },
    },
  })

  if (entries.length === 0) {
    return NextResponse.json([])
  }

  const results = await (prisma as any).marchMadnessResult.findMany()
  const resultByGame = new Map<string, { winner: string; round: number }>()
  for (const r of results) {
    resultByGame.set(r.gameId, { winner: r.winner, round: r.round })
  }

  const leaderboard = entries.map((entry: any, idx: number) => {
    let score = 0
    let correct = 0
    let total = 0

    for (const pick of entry.picks) {
      const result = resultByGame.get(pick.gameId)
      if (!result) continue
      total++
      if (pick.winnerTeam === result.winner) {
        correct++
        score += pointsForRound(result.round)
      }
    }

    return {
      bracketId: entry.id,
      bracketName: entry.name,
      ownerName: entry.user?.displayName || entry.user?.username || entry.user?.email || "Unknown",
      avatar: entry.user?.avatarUrl || null,
      score,
      correct,
      total,
    }
  })

  leaderboard.sort((a: any, b: any) => b.score - a.score)
  leaderboard.forEach((e: any, i: number) => { e.rank = i + 1 })

  return NextResponse.json(leaderboard)
}
