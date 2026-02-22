import { Queue } from "bullmq"

const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1"
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? "6000", 10)

export const redisConnection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
}

export const simulationQueue = new Queue("simulations", {
  connection: redisConnection,
})

export const QUEUE_PREFIX = "fcb"
