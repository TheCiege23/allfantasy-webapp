import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { leagueId, name } = body as { leagueId: string; name: string }

  if (!leagueId || !name?.trim())
    return NextResponse.json(
      { error: "leagueId and name are required" },
      { status: 400 }
    )

  const member = await (prisma as any).bracketLeagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId,
        userId: auth.userId,
      },
    },
  })
  if (!member)
    return NextResponse.json(
      { error: "You must be a member of this league to create an entry" },
      { status: 403 }
    )

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { id: leagueId },
    select: { tournamentId: true },
  })
  if (!league)
    return NextResponse.json({ error: "League not found" }, { status: 404 })

  const entry = await (prisma as any).bracketEntry.create({
    data: {
      leagueId,
      userId: auth.userId,
      name: name.trim(),
    },
    select: { id: true },
  })

  return NextResponse.json({
    ok: true,
    entryId: entry.id,
    tournamentId: league.tournamentId,
  })
}
