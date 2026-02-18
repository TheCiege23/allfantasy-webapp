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

  const existing = await (prisma as any).bracketEntry.findFirst({
    where: { leagueId, userId: auth.userId },
    select: { id: true, league: { select: { tournamentId: true } } },
  }).catch(() => null)

  if (existing) {
    return NextResponse.json({
      ok: true,
      entryId: existing.id,
      tournamentId: existing.league.tournamentId,
      alreadyExists: true,
    })
  }

  const entry = await (prisma as any).bracketEntry.create({
    data: {
      leagueId,
      userId: auth.userId,
      name,
    },
    select: { id: true, league: { select: { tournamentId: true } } },
  })

  return NextResponse.json({
    ok: true,
    entryId: entry.id,
    tournamentId: entry.league.tournamentId,
  })
}
