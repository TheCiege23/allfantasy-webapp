import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
  }

  const tournamentId = req.nextUrl.searchParams.get("tournamentId")
  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId is required" }, { status: 400 })
  }

  const memberships = await (prisma as any).bracketLeagueMember.findMany({
    where: { userId: session.user.id },
    select: { leagueId: true },
  })

  const leagueIds = memberships.map((m: any) => m.leagueId)

  if (leagueIds.length === 0) {
    return NextResponse.json({ leagues: [] })
  }

  const leagues = await (prisma as any).bracketLeague.findMany({
    where: {
      id: { in: leagueIds },
      tournamentId,
    },
    select: {
      id: true,
      name: true,
      joinCode: true,
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    leagues: leagues.map((lg: any) => ({
      id: lg.id,
      name: lg.name,
      joinCode: lg.joinCode,
      memberCount: lg._count.members,
    })),
  })
}

function makeJoinCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { name, season, sport, maxManagers, scoringMode, isPublic, allowCopyBracket, pickVisibility, insuranceEnabled } = body as {
    name: string
    season: number
    sport: string
    maxManagers?: number
    scoringMode?: string
    isPublic?: boolean
    allowCopyBracket?: boolean
    pickVisibility?: string
    insuranceEnabled?: boolean
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

  const normalizedMaxManagers = Math.min(10000, Math.max(2, Number(maxManagers || 10000)))

  let joinCode = makeJoinCode()
  for (let i = 0; i < 5; i++) {
    const exists = await (prisma as any).bracketLeague.findUnique({
      where: { joinCode },
    })
    if (!exists) break
    joinCode = makeJoinCode()
  }

  const validModes = ["fancred_edge", "momentum", "accuracy_boldness", "streak_survival"]
  const selectedMode = validModes.includes(scoringMode || "") ? scoringMode : "fancred_edge"
  const isPrivateLeague = isPublic === true ? false : true

  const league = await (prisma as any).bracketLeague.create({
    data: {
      name,
      tournamentId: tournament.id,
      ownerId: auth.userId,
      maxManagers: normalizedMaxManagers,
      joinCode,
      isPrivate: isPrivateLeague,
      scoringRules: {
        mode: selectedMode,
        scoringMode: selectedMode,
        allowCopyBracket: allowCopyBracket !== false,
        pickVisibility: pickVisibility === "hidden_until_lock" ? "hidden_until_lock" : "visible",
        insuranceEnabled: Boolean(insuranceEnabled),
        insurancePerEntry: 1,
      },
      members: {
        create: { userId: auth.userId, role: "ADMIN" },
      },
    },
    select: { id: true, joinCode: true },
  })

  return NextResponse.json({
    ok: true,
    leagueId: league.id,
    joinCode: league.joinCode,
    maxManagers: normalizedMaxManagers,
  })
}
