import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { simulationQueue } from "@/lib/queues/bullmq"

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
    return NextResponse.json({ error: "jobId is required" }, { status: 400 })
  }

  try {
    const job = await simulationQueue.getJob(jobId)
    if (!job) {
      return NextResponse.json({ error: "Job not found or expired" }, { status: 404 })
    }

    if (job.data?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const state = await job.getState()
    const progress = job.progress

    const response: any = {
      jobId,
      state,
      runs: job.data?.runs,
      progress: typeof progress === "number" ? progress : 0,
    }

    if (state === "completed") {
      response.result = job.returnvalue
    }

    if (state === "failed") {
      response.error = job.failedReason ?? "Simulation failed"
    }

    return NextResponse.json(response)
  } catch (err: any) {
    console.error("[lab/simulations/status] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to get job status" }, { status: 500 })
  }
}
