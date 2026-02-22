type SimJob = {
  state: "queued" | "running" | "completed" | "failed"
  userId: string
  bracketId: string
  tournamentId: string
  runs: number
  createdAt: number
  result?: any
  error?: string
}

const store = new Map<string, SimJob>()

const MAX_AGE_MS = 30 * 60 * 1000

function cleanup() {
  const now = Date.now()
  for (const [key, job] of store.entries()) {
    if (now - job.createdAt > MAX_AGE_MS) {
      store.delete(key)
    }
  }
}

setInterval(cleanup, 5 * 60 * 1000)

export const simJobStore = store
