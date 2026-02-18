import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"

function makeJoinCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, season, sport } = body as {
    name: string
    season: number
    sport: string
  }
  if (!name || !season || !sport)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const tournament = await (prisma as any).bracketTournament.findUnique({
    where: { sport_season: { sport, season } },
    select: { id: true },
  })
  if (!tournament)
    return NextResponse.json(
      { error: "Tournament not found for that sport/season" },
      { status: 404 }
    )

  let joinCode = makeJoinCode()
  for (let i = 0; i < 5; i++) {
    const exists = await (prisma as any).bracketLeague.findUnique({
      where: { joinCode },
    })
    if (!exists) break
    joinCode = makeJoinCode()
  }

  const league = await (prisma as any).bracketLeague.create({
    data: {
      name,
      tournamentId: tournament.id,
      ownerId: session.user.id,
      joinCode,
      members: {
        create: { userId: session.user.id, role: "ADMIN" },
      },
    },
    select: { id: true, joinCode: true },
  })

  return NextResponse.json({
    ok: true,
    leagueId: league.id,
    joinCode: league.joinCode,
  })
}
