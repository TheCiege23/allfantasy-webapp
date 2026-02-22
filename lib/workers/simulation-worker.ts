import { Worker, Job } from "bullmq"
import { redisConnection } from "@/lib/queues/bullmq"
import { prisma } from "@/lib/prisma"

type SimJobData = {
  userId: string
  bracketId: string
  tournamentId: string
  runs: number
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

async function processSimulation(job: Job<SimJobData>) {
  const { bracketId, tournamentId, runs } = job.data

  const picks = await (prisma as any).bracketPick.findMany({
    where: { entryId: bracketId },
    select: { nodeId: true, pickedTeamName: true },
  })

  const nodes = await (prisma as any).bracketNode.findMany({
    where: { tournamentId },
    select: {
      id: true,
      slot: true,
      round: true,
      region: true,
      seedHome: true,
      seedAway: true,
      homeTeamName: true,
      awayTeamName: true,
    },
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
    return acc + (nd.winProb >= 0.5 ? nd.points : 0)
  }, 0)

  let totalScore = 0
  let beatChalkCount = 0
  let totalUserUpsetHits = 0
  let totalSimUpsets = 0
  let maxScore = 0
  let minScore = Infinity
  const roundScores: Record<number, number> = {}

  const progressInterval = Math.max(1, Math.floor(runs / 20))

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
        if (isUpset) pts += nd.upsetDelta
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

    if (i % progressInterval === 0) {
      await job.updateProgress(Math.round((i / runs) * 100))
    }
  }

  await job.updateProgress(100)

  const avgScore = Math.round(totalScore / runs)
  const winPct = Math.round((beatChalkCount / runs) * 1000) / 10
  const avgUpsetHits = Math.round((totalUserUpsetHits / runs) * 10) / 10
  const avgSimUpsets = Math.round((totalSimUpsets / runs) * 10) / 10

  const roundAvg: Record<string, number> = {}
  for (const [r, total] of Object.entries(roundScores)) {
    roundAvg[`R${r}`] = Math.round(total / runs)
  }

  return {
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
}

export function startSimulationWorker() {
  const worker = new Worker("simulations", processSimulation, {
    connection: redisConnection,
    concurrency: 2,
    stalledInterval: 30000,
  })

  worker.on("completed", (job) => {
    console.log(`[SimWorker] Job ${job.id} completed`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[SimWorker] Job ${job?.id} failed:`, err.message)
  })

  worker.on("error", (err) => {
    console.error("[SimWorker] Worker error:", err)
  })

  console.log("[SimWorker] Simulation worker started (concurrency: 2)")
  return worker
}
