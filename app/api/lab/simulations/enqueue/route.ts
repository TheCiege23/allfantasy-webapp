import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import { simJobStore } from "@/lib/sim-job-store"

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
      return NextResponse.json({ error: "bracketId and tournamentId are required" }, { status: 400 })
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

    const simRuns = Math.min(10000, Math.max(100, Number(runs) || 10000))

    const jobId = randomUUID()

    simJobStore.set(jobId, {
      state: "queued",
      userId,
      bracketId,
      tournamentId,
      runs: simRuns,
      createdAt: Date.now(),
    })

    runSimulationAsync(jobId, bracketId, tournamentId, simRuns)

    return NextResponse.json({ ok: true, jobId, runs: simRuns })
  } catch (err: any) {
    console.error("[lab/simulations/enqueue] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to enqueue simulation" }, { status: 500 })
  }
}

async function runSimulationAsync(jobId: string, bracketId: string, tournamentId: string, runs: number) {
  const job = simJobStore.get(jobId)
  if (!job) return
  job.state = "running"

  try {
    const picks = await (prisma as any).bracketPick.findMany({
      where: { entryId: bracketId },
      select: { nodeId: true, pickedTeamName: true },
    })

    const nodes = await (prisma as any).bracketNode.findMany({
      where: { tournamentId },
      select: { id: true, slot: true, round: true, region: true, seedHome: true, seedAway: true, homeTeamName: true, awayTeamName: true },
    })

    const totalGames = nodes.length || 63
    const userPicks = picks.length || 0

    const pickMap = new Map<string, string>()
    for (const p of picks) {
      if (p.pickedTeamName) pickMap.set(p.nodeId, p.pickedTeamName)
    }

    const nodeData = nodes.map((n: any) => ({
      id: n.id,
      round: n.round,
      seedHome: n.seedHome || 8,
      seedAway: n.seedAway || 8,
      homeTeamName: n.homeTeamName,
      awayTeamName: n.awayTeamName,
      winProb: seedToWinProb(n.seedHome, n.seedAway),
      points: roundToEdgePoints(n.round),
      upsetDelta: Math.abs((n.seedHome || 8) - (n.seedAway || 8)),
    }))

    const chalkScore = nodeData.reduce((acc: number, nd: any) => {
      const faveWins = nd.winProb >= 0.5
      return acc + (faveWins ? nd.points : 0)
    }, 0)

    let totalScore = 0
    let beatChalkCount = 0
    let totalUserUpsetHits = 0
    let totalSimUpsets = 0
    let maxScore = 0
    let minScore = Infinity
    const roundScores: Record<number, number> = {}

    for (let i = 0; i < runs; i++) {
      let score = 0
      let simUpsets = 0
      let userUpsetHits = 0

      for (const nd of nodeData) {
        const homeWins = Math.random() < nd.winProb
        const winner = homeWins ? nd.homeTeamName : nd.awayTeamName
        const winnerSeed = homeWins ? nd.seedHome : nd.seedAway
        const loserSeed = homeWins ? nd.seedAway : nd.seedHome
        const isUpset = winnerSeed > loserSeed

        if (isUpset) simUpsets++

        const userPick = pickMap.get(nd.id)
        if (userPick && userPick === winner) {
          let pts = nd.points
          if (isUpset) {
            pts += nd.upsetDelta
          }
          score += pts
          if (!roundScores[nd.round]) roundScores[nd.round] = 0
          roundScores[nd.round] += pts
          if (isUpset) userUpsetHits++
        }
      }

      totalScore += score
      totalSimUpsets += simUpsets
      totalUserUpsetHits += userUpsetHits
      if (score > chalkScore) beatChalkCount++
      if (score > maxScore) maxScore = score
      if (score < minScore) minScore = score
    }

    const avgScore = Math.round(totalScore / runs)
    const winPct = Math.round((beatChalkCount / runs) * 1000) / 10
    const avgUpsetHits = Math.round((totalUserUpsetHits / runs) * 10) / 10
    const avgSimUpsets = Math.round((totalSimUpsets / runs) * 10) / 10

    const roundAvg: Record<string, number> = {}
    for (const [r, total] of Object.entries(roundScores)) {
      roundAvg[`R${r}`] = Math.round(total / runs)
    }

    job.state = "completed"
    job.result = {
      summary: {
        winPct,
        avgScore,
        upsetRate: avgUpsetHits,
        chalkBaseline: chalkScore,
        maxScore,
        minScore: minScore === Infinity ? 0 : minScore,
        avgSimUpsets,
      },
      roundBreakdown: roundAvg,
      scoring: "FanCred EDGE: R64=1, R32=2, S16=5, E8=10, F4=18, CH=30 + Upset Delta Bonus",
      runs,
      bracketId,
      totalPicks: userPicks,
      totalGames,
      completedAt: new Date().toISOString(),
    }
  } catch (err: any) {
    console.error("[sim-job] Error:", err)
    job.state = "failed"
    job.error = err.message || "Simulation failed"
  }
}

function seedToWinProb(seedA: number | null, seedB: number | null): number {
  const a = seedA || 8
  const b = seedB || 8
  if (a === b) return 0.5
  const diff = b - a
  return 1 / (1 + Math.pow(10, -diff / 4))
}

function roundToEdgePoints(round: number): number {
  const map: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 10, 5: 18, 6: 30 }
  return map[round] || 1
}
