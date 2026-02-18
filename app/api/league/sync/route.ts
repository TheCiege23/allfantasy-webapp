import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { syncLeague, getDecryptedAuth } from '@/lib/league-sync-core';

export async function POST(req: NextRequest) {
  let userId: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit(`league-sync:${ip}`, 5, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { platform, platformLeagueId } = await req.json();

    if (!platform || !platformLeagueId) {
      return NextResponse.json({ error: 'Missing required fields: platform and platformLeagueId' }, { status: 400 });
    }

    const normalizedPlatform = platform.toLowerCase();

    if (!['sleeper', 'mfl', 'espn', 'yahoo', 'fantrax'].includes(normalizedPlatform)) {
      return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
    }

    if (normalizedPlatform !== 'sleeper') {
      const auth = await getDecryptedAuth(userId, normalizedPlatform);
      const missing =
        (normalizedPlatform === 'mfl' && !auth?.apiKey) ||
        (normalizedPlatform === 'espn' && (!auth?.espnSwid || !auth?.espnS2)) ||
        (normalizedPlatform === 'yahoo' && !auth?.oauthToken);

      if (missing) {
        return NextResponse.json(
          {
            error: `${normalizedPlatform.toUpperCase()} credentials required. Save them in League Settings first.`,
            authRequired: true,
            platform: normalizedPlatform,
          },
          { status: 403 }
        );
      }
    }

    const result = await syncLeague(userId, normalizedPlatform, platformLeagueId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[League Sync]', error);

    try {
      if (userId) {
        await (prisma as any).league.updateMany({
          where: { userId, syncStatus: 'pending' },
          data: {
            syncStatus: 'error',
            syncError: (error.message || 'Unknown error').slice(0, 500),
          },
        });
      }
    } catch {}

    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
