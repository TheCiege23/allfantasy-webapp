import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeWinProbability, runPoolSimulation } from "@/lib/brackets/intelligence/data-engine"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function buildSimEntries(leagueId: string, tournamentId: string) {
  const entries = await prisma.bracketEntry.findMany({
    where: { leagueId },
    include: {
      user: { select: { id: true, displayName: true } },
      picks: {
        include: {
          node: { select: { id: true, round: true, seedHome: true, seedAway: true, homeTeamName: true, awayTeamName: true } },
        },
      },
    },
  })

  const nodes = await prisma.bracketNode.findMany({
    where: { tournamentId },
    include: { picks: { select: { isCorrect: true } } },
  })

  const decidedNodes = new Set(
    nodes.filter(n => n.picks.some(p => p.isCorrect !== null)).map(n => n.id)
  )

  return entries.map(entry => {
    const currentPoints = entry.picks.reduce((s, p) => s + p.points, 0)

    const remainingPicks = entry.picks
      .filter(p => p.isCorrect === null && p.pickedTeamName && !decidedNodes.has(p.nodeId))
      .map(p => {
        const node = p.node
        const pickedTeam = p.pickedTeamName!
        const isFavorite = node.homeTeamName === pickedTeam
          ? (node.seedHome ?? 8) <= (node.seedAway ?? 8)
          : (node.seedAway ?? 8) <= (node.seedHome ?? 8)

        const seedA = isFavorite ? (node.seedHome ?? 8) : (node.seedAway ?? 8)
        const seedB = isFavorite ? (node.seedAway ?? 8) : (node.seedHome ?? 8)
        const prob = computeWinProbability(seedA, seedB)

        return {
          nodeId: p.nodeId,
          pickedTeamName: pickedTeam,
          round: node.round,
          winProb: isFavorite ? prob.teamA : prob.teamB,
        }
      })

    return {
      entryId: entry.id,
      userId: entry.userId,
      displayName: entry.user.displayName ?? "Unknown",
      currentPoints,
      remainingPicks,
    }
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get("leagueId")

  if (!leagueId) {
    return new Response("Missing leagueId", { status: 400 })
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  })
  if (!member) {
    return new Response("Not a league member", { status: 403 })
  }

  const league = await prisma.bracketLeague.findUnique({
    where: { id: leagueId },
    select: { tournamentId: true },
  })
  if (!league) {
    return new Response("League not found", { status: 404 })
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

      send("connected", { leagueId, ts: Date.now() })

      const runSim = async () => {
        if (closed) return
        try {
          const simEntries = await buildSimEntries(leagueId, league.tournamentId)
          if (simEntries.length === 0) {
            send("win_probability_update", { results: [], runs: 0, ts: Date.now() })
            return
          }

          const results = runPoolSimulation(simEntries, 1000)

          const enriched = results.map(r => {
            const entry = simEntries.find(e => e.entryId === r.entryId)
            return {
              ...r,
              displayName: entry?.displayName ?? "Unknown",
              currentPoints: entry?.currentPoints ?? 0,
            }
          }).sort((a, b) => b.winRate - a.winRate)

          send("win_probability_update", {
            results: enriched,
            runs: 1000,
            ts: Date.now(),
          })
        } catch (err: any) {
          send("error", { message: err?.message || "simulation error" })
        }
      }

      await runSim()

      const interval = setInterval(runSim, 30000)

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
