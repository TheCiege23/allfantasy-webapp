import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const GET = withApiUsage({ endpoint: "/api/legacy/import/status", tool: "LegacyImportStatus" })(async (request: NextRequest) => {
  const jobId = request.nextUrl.searchParams.get('job_id');
  const sleeperUsername = request.nextUrl.searchParams.get('sleeper_username')?.trim().toLowerCase();

  let job;

  if (jobId) {
    job = await prisma.legacyImportJob.findUnique({
      where: { id: jobId },
    });
  } else if (sleeperUsername) {
    const user = await prisma.legacyUser.findFirst({
      where: { sleeperUsername },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // First look for an active job (running or queued)
    job = await prisma.legacyImportJob.findFirst({
      where: { userId: user.id, status: { in: ['running', 'queued'] } },
      orderBy: { createdAt: 'desc' },
    });
    
    // If no active job, get the most recent completed one
    if (!job) {
      job = await prisma.legacyImportJob.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
    }
  } else {
    return NextResponse.json({ error: 'Missing job_id or sleeper_username' }, { status: 400 });
  }

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    message: (job as any).message ?? null,
    started_at: job.startedAt,
    completed_at: job.completedAt,
  });
})
