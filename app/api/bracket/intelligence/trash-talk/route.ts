import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { narrateTrashTalk } from "@/lib/brackets/intelligence/ai-narrator"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const leagueId = String(body.leagueId || "")
  const eventType = String(body.eventType || "")

  if (!leagueId) {
    return NextResponse.json({ error: "Missing leagueId" }, { status: 400 })
  }

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: auth.userId } },
  })
  if (!member) {
    return NextResponse.json({ error: "Not a league member" }, { status: 403 })
  }

  const league = await prisma.bracketLeague.findUnique({
    where: { id: leagueId },
    select: { tournamentId: true, scoringRules: true },
  })
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 })
  }

  const where: any = { tournamentId: league.tournamentId }
  if (eventType) where.eventType = eventType
  where.leagueId = { in: [leagueId, null] }

  const recentEvents = await (prisma as any).bracketFeedEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  if (recentEvents.length === 0) {
    return NextResponse.json({
      ok: true,
      messages: [],
      message: "No recent events to trash talk about.",
    })
  }

  const messages: Array<{ eventId: string; eventType: string; headline: string; trashTalk: string }> = []

  for (const event of recentEvents.slice(0, 3)) {
    const trashTalk = await narrateTrashTalk({
      eventType: event.eventType,
      headline: event.headline,
      detail: event.detail ?? "",
      metadata: event.metadata ?? {},
    })

    if (trashTalk) {
      messages.push({
        eventId: event.id,
        eventType: event.eventType,
        headline: event.headline,
        trashTalk,
      })
    }
  }

  return NextResponse.json({ ok: true, messages })
}
