import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSleeperUser } from '@/lib/sleeper-client';
import { rateLimit } from '@/lib/rate-limit';
import { trackLegacyToolUsage } from '@/lib/analytics-server';

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

    const username = sleeper_username.trim().toLowerCase();

    let user = await prisma.legacyUser.findUnique({
      where: { sleeperUsername: username },
    });

    if (!user) {
      const sleeperUser = await getSleeperUser(username);
      
      if (!sleeperUser) {
        return NextResponse.json(
          { error: 'Sleeper user not found' },
          { status: 404 }
        );
      }

      user = await prisma.legacyUser.create({
        data: {
          sleeperUsername: username,
          sleeperUserId: sleeperUser.user_id,
          displayName: sleeperUser.display_name || sleeperUser.username,
          avatar: sleeperUser.avatar ? `https://sleepercdn.com/avatars/thumbs/${sleeperUser.avatar}` : null,
        },
      });
    }

    const existingJob = await prisma.legacyImportJob.findFirst({
      where: {
        userId: user.id,
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
      });
    }

    const job = await prisma.legacyImportJob.create({
      data: {
        userId: user.id,
        status: 'queued',
        progress: 0,
      },
    });

    // Track tool usage
    trackLegacyToolUsage('legacy_import', user.id, null, { username })

    return NextResponse.json({
      success: true,
      message: 'Import queued',
      job_id: job.id,
      user_id: user.id,
      sleeper_user_id: user.sleeperUserId,
      display_name: user.displayName,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error('Legacy import error:', error);
    return NextResponse.json(
      { error: 'Failed to start import', details: String(error) },
      { status: 500 }
    );
  }
})

