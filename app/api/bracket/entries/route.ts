import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
        userId: session.user.id,
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
      userId: session.user.id,
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
