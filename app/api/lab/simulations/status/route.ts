import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { simJobStore } from "@/lib/sim-job-store"

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

  const job = simJobStore.get(jobId)
  if (!job) {
    return NextResponse.json({ error: "Job not found or expired" }, { status: 404 })
  }

  if (job.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({
    jobId,
    state: job.state,
    runs: job.runs,
    ...(job.state === "completed" ? { result: job.result } : {}),
    ...(job.state === "failed" ? { error: job.error } : {}),
  })
}
