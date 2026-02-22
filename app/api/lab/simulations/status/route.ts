import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { simulationQueue, redis } from "@/lib/queues/bullmq"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const jobId = req.nextUrl.searchParams.get("jobId")
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 })
  }

  try {
    const job = await simulationQueue.getJob(jobId)
    if (!job) {
      return NextResponse.json({ state: "missing" }, { status: 404 })
    }

    if (job.data?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const state = await job.getState()
    const progress = job.progress

    if (state === "completed") {
      const rv: any = job.returnvalue
      const cacheKey: string | undefined = rv?.cacheKey
      if (cacheKey) {
        const raw = await redis.get(cacheKey)
        const result = raw ? JSON.parse(raw) : rv?.result ?? null
        return NextResponse.json({ state: "completed", result, cached: rv?.cached ?? false })
      }
      return NextResponse.json({ state: "completed", result: rv?.result ?? rv ?? null })
    }

    if (state === "failed") {
      return NextResponse.json({
        state: "failed",
        error: job.failedReason ?? "Simulation failed",
      })
    }

    return NextResponse.json({
      state,
      progress: typeof progress === "number" ? progress : 0,
      runs: job.data?.runs,
    })
  } catch (err: any) {
    console.error("[lab/simulations/status] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to get job status" }, { status: 500 })
  }
}
