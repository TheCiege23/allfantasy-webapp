// app/api/legacy/worker/run/route.ts
import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runLegacyImportStep } from '@/lib/legacy-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/legacy/worker/run", tool: "LegacyWorkerRun" })(async () => {
  // Find the oldest job that needs processing (queued or running)
  const job = await prisma.legacyImportJob.findFirst({
    where: { status: { in: ['queued', 'running'] } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, sleeperUserId: true } } },
  });

  if (!job) {
    return NextResponse.json({ ok: true, message: 'No jobs to process.' });
  }

  if (!job.user) {
    await prisma.legacyImportJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        progress: 100,
        completedAt: new Date(),
        error: 'LegacyUser not found',
      },
    });
    return NextResponse.json({ ok: false, message: 'Job failed: missing user.' }, { status: 500 });
  }

  try {
    // Process ONE season step
    const result = await runLegacyImportStep(job.id, job.user.id, job.user.sleeperUserId);

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      done: result.done,
      progress: result.progress,
    });
  } catch (e: any) {
    console.error('Worker error:', e);
    await prisma.legacyImportJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: e?.message || 'Unknown error',
      },
    });
    return NextResponse.json(
      { ok: false, message: e?.message || 'Worker error', jobId: job.id },
      { status: 500 }
    );
  }
})
