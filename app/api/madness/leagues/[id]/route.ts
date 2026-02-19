import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { members: true, entries: true } },
      tournament: {
        select: { id: true, name: true, season: true },
      },
    },
  })

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 })
  }

  const userBrackets = await (prisma as any).bracketEntry.count({
    where: { leagueId: params.id, userId: session.user.id },
  })

  return NextResponse.json({
    id: league.id,
    name: league.name,
    joinCode: league.joinCode,
    maxManagers: league.maxManagers,
    deadline: league.deadline,
    scoringRules: league.scoringRules,
    memberCount: league._count.members,
    entryCount: league._count.entries,
    userBracketsCount: userBrackets,
    tournament: {
      id: league.tournament.id,
      name: league.tournament.name,
      season: league.tournament.season,
    },
  })
}
