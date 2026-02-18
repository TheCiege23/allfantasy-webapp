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

  const { joinCode } = await req.json()
  if (!joinCode)
    return NextResponse.json({ error: "Missing joinCode" }, { status: 400 })

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { joinCode },
    select: { id: true },
  })
  if (!league)
    return NextResponse.json({ error: "Invalid code" }, { status: 404 })

  await (prisma as any).bracketLeagueMember.upsert({
    where: {
      leagueId_userId: {
        leagueId: league.id,
        userId: session.user.id,
      },
    },
    update: {},
    create: {
      leagueId: league.id,
      userId: session.user.id,
      role: "MEMBER",
    },
  })

  return NextResponse.json({ ok: true, leagueId: league.id })
}
