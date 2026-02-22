import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function fetchLiveData(tournamentId: string, leagueId?: string) {
  const nodes = await prisma.bracketNode.findMany({
    where: { tournamentId },
    orderBy: [{ round: "asc" }, { slot: "asc" }],
  })

  const linkedGameIds = nodes.map((n) => n.sportsGameId).filter((id): id is string => id !== null)

  const games = linkedGameIds.length > 0
    ? await prisma.sportsGame.findMany({
        where: { id: { in: linkedGameIds } },
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          homeScore: true,
          awayScore: true,
          status: true,
          startTime: true,
        },
      })
    : []

  const gamesFlat = games.map((g) => ({
    id: g.id,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    status: g.status,
    startTime: g.startTime ? g.startTime.toISOString() : null,
  }))

  const hasLive = games.some((g) => g.status === "in_progress")

  let standings = null
  if (leagueId) {
    const entries = await prisma.bracketEntry.findMany({
      where: { leagueId },
      include: {
        user: { select: { id: true, displayName: true } },
        picks: true,
      },
    })

    standings = entries
      .map((entry) => {
        let totalPoints = 0
        let correctPicks = 0
        for (const pick of entry.picks) {
          totalPoints += pick.points ?? 0
          if (pick.isCorrect === true) correctPicks++
        }
        return {
          entryId: entry.id,
          entryName: entry.name,
          userId: entry.userId,
          displayName: entry.user.displayName,
          totalPoints,
          correctPicks,
        }
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
  }

  return { games: gamesFlat, standings, hasLive, ts: Date.now() }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get("tournamentId")
  const leagueId = searchParams.get("leagueId") ?? undefined

  if (!tournamentId) {
    return new Response("Missing tournamentId", { status: 400 })
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  if (leagueId) {
    const member = await prisma.bracketLeagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    })
    if (!member) {
      return new Response("Not a league member", { status: 403 })
    }
  }

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      send("connected", { tournamentId, ts: Date.now() })

      const poll = async () => {
        if (closed) return
        try {
          const data = await fetchLiveData(tournamentId, leagueId)
          send("update", data)
        } catch (err: any) {
          send("error", { message: err?.message || "fetch error" })
        }
      }

      await poll()

      const interval = setInterval(poll, 15000)

      request.signal.addEventListener("abort", () => {
        closed = true
        clearInterval(interval)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
