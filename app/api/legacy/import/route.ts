import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { trackLegacyToolUsage } from '@/lib/analytics-server';
import { resolveOrCreateLegacyUser } from '@/lib/legacy-user-resolver';

export const POST = withApiUsage({ endpoint: "/api/legacy/import", tool: "LegacyImport" })(async (request: NextRequest) => {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = rateLimit(ip, 5, 60000);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { sleeper_username } = body;

    if (!sleeper_username || typeof sleeper_username !== 'string') {
      return NextResponse.json(
        { error: 'Missing sleeper_username' },
        { status: 400 }
      );
    }

    const resolved = await resolveOrCreateLegacyUser(sleeper_username);

    if (!resolved) {
      return NextResponse.json(
        { error: 'Sleeper user not found' },
        { status: 404 }
      );
    }

    const existingJob = await prisma.legacyImportJob.findFirst({
      where: {
        userId: resolved.id,
        status: { in: ['queued', 'running'] },
      },
    });

    if (existingJob) {
      return NextResponse.json({
        success: true,
        message: 'Import already in progress',
        job_id: existingJob.id,
        status: existingJob.status,
        progress: existingJob.progress,
        username_changed: resolved.usernameChanged,
        previous_username: resolved.previousUsername,
      });
    }

    const job = await prisma.legacyImportJob.create({
      data: {
        userId: resolved.id,
        status: 'queued',
        progress: 0,
      },
    });

    trackLegacyToolUsage('legacy_import', resolved.id, null, {
      username: resolved.sleeperUsername,
      usernameChanged: resolved.usernameChanged,
      previousUsername: resolved.previousUsername,
    })

    return NextResponse.json({
      success: true,
      message: resolved.usernameChanged
        ? `Welcome back! Your username was updated from "${resolved.previousUsername}" to "${resolved.sleeperUsername}". All your data has been preserved.`
        : 'Import queued',
      job_id: job.id,
      user_id: resolved.id,
      sleeper_user_id: resolved.sleeperUserId,
      display_name: resolved.displayName,
      avatar: resolved.avatar,
      username_changed: resolved.usernameChanged,
      previous_username: resolved.previousUsername,
    });
  } catch (error) {
    console.error('Legacy import error:', error);
    return NextResponse.json(
      { error: 'Failed to start import', details: String(error) },
      { status: 500 }
    );
  }
})

