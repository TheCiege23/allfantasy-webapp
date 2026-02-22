import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const leagueId = String(body?.leagueId || "")
  const name = String(body?.name || "").trim()

  if (!leagueId) {
    return NextResponse.json({ error: "MISSING_LEAGUE_ID" }, { status: 400 })
  }

  if (!name) {
    return NextResponse.json({ error: "MISSING_NAME" }, { status: 400 })
  }

  const member = await (prisma as any).bracketLeagueMember.findUnique({
    where: {
      leagueId_userId: { leagueId, userId: auth.userId },
    },
    select: { leagueId: true },
  }).catch(() => null)

  if (!member) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { id: leagueId },
    select: {
      tournamentId: true,
      scoringRules: true,
      ownerId: true,
      tournament: { select: { lockAt: true } },
    },
  })

  if (!league) {
    return NextResponse.json({ error: "LEAGUE_NOT_FOUND" }, { status: 404 })
  }

  const lockAt = league.tournament?.lockAt
  if (lockAt && new Date(lockAt) <= new Date()) {
    return NextResponse.json(
      {
        error: "BRACKET_LOCKED",
        message: "Brackets are locked. The tournament has already started.",
      },
      { status: 409 }
    )
  }

  const count = await (prisma as any).bracketEntry.count({
    where: { leagueId, userId: auth.userId },
  })

  const entry = await (prisma as any).bracketEntry.create({
    data: {
      leagueId,
      userId: auth.userId,
      name,
    },
    select: { id: true },
  })

  return NextResponse.json({
    ok: true,
    entryId: entry.id,
    tournamentId: league.tournamentId,
    entryCountForUser: count + 1,
  })
}
