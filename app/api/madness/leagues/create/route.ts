import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, maxManagers, deadline, scoringRules } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: "League name is required" }, { status: 400 })
  }

  let tournament = await (prisma as any).bracketTournament.findFirst({
    where: { sport: "NCAAB", season: new Date().getFullYear() },
    orderBy: { createdAt: "desc" },
  })

  if (!tournament) {
    tournament = await (prisma as any).bracketTournament.create({
      data: {
        name: `March Madness ${new Date().getFullYear()}`,
        season: new Date().getFullYear(),
        sport: "NCAAB",
      },
    })
  }

  const joinCode = crypto.randomBytes(4).toString("hex").toUpperCase()

  const league = await (prisma as any).bracketLeague.create({
    data: {
      name: name.trim(),
      tournamentId: tournament.id,
      ownerId: session.user.id,
      joinCode,
      maxManagers: Math.min(10000, maxManagers || 10000),
      deadline: deadline ? new Date(deadline) : null,
      scoringRules: scoringRules || {
        round1: 1,
        round2: 2,
        sweet16: 4,
        elite8: 8,
        final4: 16,
        championship: 32,
      },
    },
  })

  await (prisma as any).bracketLeagueMember.create({
    data: {
      leagueId: league.id,
      userId: session.user.id,
      role: "OWNER",
    },
  })

  return NextResponse.json({ leagueId: league.id, joinCode })
}
