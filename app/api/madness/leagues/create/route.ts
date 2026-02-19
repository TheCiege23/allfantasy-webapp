import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import crypto from "crypto"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
  }

  const body = await req.json()
  const { name, maxManagers, deadline, scoringRules } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "League name is required" }, { status: 400 })
  }

  if (maxManagers && (maxManagers < 2 || maxManagers > 1000)) {
    return NextResponse.json({ error: "Max managers must be between 2 and 1000" }, { status: 400 })
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
      maxManagers: maxManagers || 100,
      deadline: deadline ? new Date(deadline) : null,
      scoringRules: scoringRules || {
        round1: 10,
        round2: 20,
        sweet16: 40,
        elite8: 80,
        final4: 160,
        championship: 320,
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
