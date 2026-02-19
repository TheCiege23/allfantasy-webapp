import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { leagueId, name, picks } = await req.json()

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { id: leagueId },
  })

  if (!league || (league.deadline && new Date() > new Date(league.deadline))) {
    return NextResponse.json({ error: "Deadline passed or league not found" }, { status: 403 })
  }

  const userBracketCount = await (prisma as any).bracketEntry.count({
    where: { userId: session.user.id, leagueId },
  })

  if (userBracketCount >= 3) {
    return NextResponse.json({ error: "Max 3 brackets per user" }, { status: 403 })
  }

  const bracket = await (prisma as any).bracketEntry.create({
    data: {
      leagueId,
      userId: session.user.id,
      name: name || `Bracket ${userBracketCount + 1}`,
      isFinalized: true,
      finalizedAt: new Date(),
    },
  })

  await (prisma as any).bracketPick.createMany({
    data: Object.entries(picks).map(([nodeId, winnerTeam]) => ({
      entryId: bracket.id,
      nodeId,
      pickedTeamName: winnerTeam as string,
    })),
  })

  return NextResponse.json({ success: true, bracketId: bracket.id })
}
