import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const { joinCode } = await req.json()
  if (!joinCode)
    return NextResponse.json({ error: "Missing joinCode" }, { status: 400 })

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { joinCode },
    select: { id: true, maxManagers: true, _count: { select: { members: true } } },
  })
  if (!league)
    return NextResponse.json({ error: "Invalid code" }, { status: 404 })

  const existing = await (prisma as any).bracketLeagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: league.id,
        userId: auth.userId,
      },
    },
    select: { id: true },
  })

  if (!existing && Number(league._count?.members || 0) >= Number(league.maxManagers || 100)) {
    return NextResponse.json({ error: "League is full" }, { status: 409 })
  }

  await (prisma as any).bracketLeagueMember.upsert({
    where: {
      leagueId_userId: {
        leagueId: league.id,
        userId: auth.userId,
      },
    },
    update: {},
    create: {
      leagueId: league.id,
      userId: auth.userId,
      role: "MEMBER",
    },
  })

  return NextResponse.json({ ok: true, leagueId: league.id })
}
