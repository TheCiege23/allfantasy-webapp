import { startSimulationWorker } from "../lib/workers/simulation-worker"

console.log("[Worker] Starting simulation worker process...")

const worker = startSimulationWorker()

process.on("SIGTERM", async () => {
  console.log("[Worker] SIGTERM received, shutting down...")
  await worker.close()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("[Worker] SIGINT received, shutting down...")
  await worker.close()
  process.exit(0)
})
