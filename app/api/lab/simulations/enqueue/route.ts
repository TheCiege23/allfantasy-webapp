import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getEntitlementsForUser } from "@/lib/entitlements-db"
import { getActiveTournament } from "@/lib/tournament"
import { simulationQueue } from "@/lib/queues/bullmq"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const { bracketId, tournamentId, runs } = body as {
      bracketId: string
      tournamentId: string
      runs?: number
    }

    if (!bracketId || !tournamentId) {
      return NextResponse.json({ error: "Missing bracketId or tournamentId" }, { status: 400 })
    }

    const tournament = await getActiveTournament()
    if (!tournament || tournament.id !== tournamentId) {
      return NextResponse.json({ error: "Tournament not active" }, { status: 400 })
    }

    const ent = await getEntitlementsForUser(userId, tournamentId)
    const hasPass = ent.hasBracketLabPass && ent.bracketLabPassTournamentId === tournamentId
    if (!hasPass) {
      return NextResponse.json({ error: "Lab pass required" }, { status: 403 })
    }

    const entry = await (prisma as any).bracketEntry.findUnique({
      where: { id: bracketId },
      select: { id: true, userId: true, league: { select: { tournamentId: true } } },
    })

    if (!entry) {
      return NextResponse.json({ error: "Bracket not found" }, { status: 404 })
    }

    if (entry.userId !== userId) {
      return NextResponse.json({ error: "Not your bracket" }, { status: 403 })
    }

    if (entry.league?.tournamentId !== tournamentId) {
      return NextResponse.json({ error: "Bracket does not belong to this tournament" }, { status: 400 })
    }

    const simRuns = Math.max(1000, Math.min(50000, Math.floor(Number(runs) || 10000)))

    const job = await simulationQueue.add(
      "monteCarloBracket",
      {
        userId,
        bracketId,
        tournamentId,
        runs: simRuns,
      },
      {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 2,
        backoff: { type: "exponential", delay: 2000 },
      }
    )

    return NextResponse.json({ jobId: job.id, runs: simRuns })
  } catch (err: any) {
    console.error("[lab/simulations/enqueue] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to enqueue simulation" }, { status: 500 })
  }
}
