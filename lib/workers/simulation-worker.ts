import { Worker, Job } from "bullmq"
import { redisConnection, redis } from "@/lib/queues/bullmq"
import { prisma } from "@/lib/prisma"
import { buildNodeData, simulateTournamentRuns, type SimulationResult } from "@/lib/sim/monteCarlo"

const REDIS_TTL_SECONDS = 60 * 30
const WORKER_CONCURRENCY = Number(process.env.SIM_WORKER_CONCURRENCY ?? 2)
const MODEL_VERSION = "v1"

type SimJobData = {
  userId: string
  bracketId: string
  tournamentId: string
  runs: number
}

function resultCacheKey(tournamentId: string, bracketId: string, runs: number, modelVer: string) {
  return `lab:mc:${tournamentId}:${bracketId}:runs=${runs}:v=${modelVer}`
}

async function processSimulation(job: Job<SimJobData>) {
  const { userId, bracketId, tournamentId, runs } = job.data

  const cacheKey = resultCacheKey(tournamentId, bracketId, runs, MODEL_VERSION)

  const cached = await redis.get(cacheKey)
  if (cached) {
    await job.updateProgress(100)
    return { cacheKey, result: JSON.parse(cached), cached: true }
  }

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

  if (!nodes.length) throw new Error("No bracket nodes found for tournament")

  const totalGames = nodes.length
  const userPicks = picks.length

  const pickMap = new Map<string, string>()
  for (const p of picks) {
    if (p.pickedTeamName) pickMap.set(p.nodeId, p.pickedTeamName)
  }

  const nodeData = buildNodeData(nodes)

  const scoringMode = (job.data as any).scoringMode ?? "EDGE"

  const simResult = await simulateTournamentRuns({
    runs,
    nodeData,
    pickMap,
    scoringMode,
    onProgress: async (pct) => {
      await job.updateProgress(pct)
    },
  })

  await job.updateProgress(100)

  const result: SimulationResult = {
    ...simResult,
    scoring: `FanCred ${scoringMode}: R64=1, R32=2, S16=5, E8=10, F4=18, CH=30 + Upset Delta Bonus`,
    runs,
    bracketId,
    totalPicks: userPicks,
    totalGames,
    completedAt: new Date().toISOString(),
  }

  await redis.set(cacheKey, JSON.stringify(result), "EX", REDIS_TTL_SECONDS)

  return { cacheKey, result, cached: false }
}

export function startSimulationWorker() {
  const worker = new Worker("simulations", processSimulation, {
    connection: redisConnection,
    concurrency: WORKER_CONCURRENCY,
    stalledInterval: 30000,
  })

  worker.on("completed", (job) => {
    console.log(`[SimWorker] Job ${job.id} completed (cached: ${job.returnvalue?.cached ?? false})`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[SimWorker] Job ${job?.id} failed:`, err.message)
  })

  worker.on("error", (err) => {
    console.error("[SimWorker] Worker error:", err)
  })

  console.log(`[SimWorker] Simulation worker started (concurrency: ${WORKER_CONCURRENCY})`)
  return worker
}
