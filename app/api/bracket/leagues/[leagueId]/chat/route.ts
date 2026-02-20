import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId: params.leagueId, userId } },
  })
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const cursor = req.nextUrl.searchParams.get("before")
  const limit = 50

  const messages = await (prisma as any).bracketLeagueMessage.findMany({
    where: {
      leagueId: params.leagueId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  })

  return NextResponse.json({
    messages: messages.reverse(),
    hasMore: messages.length === limit,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId: params.leagueId, userId } },
  })
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const { message } = await req.json()
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message required" }, { status: 400 })
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 })
  }

  const msg = await (prisma as any).bracketLeagueMessage.create({
    data: {
      leagueId: params.leagueId,
      userId,
      message: message.trim(),
    },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  })

  return NextResponse.json({ message: msg })
}
