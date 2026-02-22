import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tournamentId = req.nextUrl.searchParams.get("tournamentId")
  const leagueId = req.nextUrl.searchParams.get("leagueId")
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get("limit") || 30))
  const before = req.nextUrl.searchParams.get("before")

  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId required" }, { status: 400 })
  }

  const where: any = {
    tournamentId,
    ...(before ? { createdAt: { lt: new Date(before) } } : {}),
  }

  if (leagueId) {
    where.OR = [{ leagueId }, { leagueId: null }]
  } else {
    where.leagueId = null
  }

  const events = await (prisma as any).bracketFeedEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return NextResponse.json({
    events: events.map((e: any) => ({
      id: e.id,
      eventType: e.eventType,
      headline: e.headline,
      detail: e.detail,
      metadata: e.metadata,
      leagueId: e.leagueId,
      createdAt: e.createdAt.toISOString(),
    })),
    hasMore: events.length === limit,
  })
}
