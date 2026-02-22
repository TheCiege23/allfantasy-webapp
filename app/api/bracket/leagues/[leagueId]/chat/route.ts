import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const messageInclude = {
  user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
  replyTo: {
    select: {
      id: true,
      message: true,
      type: true,
      user: { select: { id: true, displayName: true, email: true } },
    },
  },
  reactions: {
    select: {
      id: true,
      emoji: true,
      userId: true,
      user: { select: { id: true, displayName: true, email: true } },
    },
  },
}

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
    include: messageInclude,
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

  const body = await req.json()
  const { message, type = "text", replyToId, imageUrl, metadata } = body

  if (type === "poll") {
    if (!metadata?.question || !metadata?.options || metadata.options.length < 2) {
      return NextResponse.json({ error: "Poll requires question and at least 2 options" }, { status: 400 })
    }
    const pollData = {
      question: String(metadata.question).slice(0, 200),
      options: metadata.options.slice(0, 6).map((o: string) => String(o).slice(0, 100)),
      votes: {} as Record<string, string[]>,
    }
    const msg = await (prisma as any).bracketLeagueMessage.create({
      data: {
        leagueId: params.leagueId,
        userId,
        message: pollData.question,
        type: "poll",
        metadata: pollData,
      },
      include: messageInclude,
    })
    return NextResponse.json({ message: msg })
  }

  if (type === "gif") {
    if (!imageUrl) return NextResponse.json({ error: "GIF URL required" }, { status: 400 })
    const msg = await (prisma as any).bracketLeagueMessage.create({
      data: {
        leagueId: params.leagueId,
        userId,
        message: message || "GIF",
        type: "gif",
        imageUrl,
        replyToId: replyToId || null,
      },
      include: messageInclude,
    })
    return NextResponse.json({ message: msg })
  }

  if (type === "image") {
    if (!imageUrl) return NextResponse.json({ error: "Image URL required" }, { status: 400 })
    const msg = await (prisma as any).bracketLeagueMessage.create({
      data: {
        leagueId: params.leagueId,
        userId,
        message: message || "",
        type: "image",
        imageUrl,
        replyToId: replyToId || null,
      },
      include: messageInclude,
    })
    return NextResponse.json({ message: msg })
  }

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
      type: "text",
      replyToId: replyToId || null,
    },
    include: messageInclude,
  })

  return NextResponse.json({ message: msg })
}
