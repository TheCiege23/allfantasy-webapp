import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { syncLeague, getDecryptedAuth } from '@/lib/league-sync-core';
import { getResendClient } from '@/lib/resend-client';

export async function POST(req: NextRequest) {
  let userId: string | undefined;
  let userEmail: string | undefined;
  let normalizedPlatform = '';
  try {
    const session = await getServerSession(authOptions);
    userId = (session?.user as any)?.id as string | undefined;
    userEmail = (session?.user as any)?.email;
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

    normalizedPlatform = platform.toLowerCase();

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

    if (result.success && process.env.NODE_ENV === 'production') {
      try {
        if (userEmail) {
          const { client, fromEmail } = await getResendClient();
          const leagueName = result.name || result.leagueName || normalizedPlatform.toUpperCase();
          await client.emails.send({
            from: fromEmail || 'AllFantasy.ai <noreply@allfantasy.ai>',
            to: userEmail,
            subject: `League Sync Complete: ${leagueName}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 16px;">
                <h2 style="background: linear-gradient(90deg, #22d3ee, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center;">AllFantasy.ai</h2>
                <h3 style="color: #4ade80;">League Sync Successful</h3>
                <p>Your ${normalizedPlatform.toUpperCase()} league <strong>"${leagueName}"</strong> was synced at ${new Date().toLocaleString()}.</p>
                <ul style="color: #94a3b8;">
                  <li>League size: ${result.leagueSize || result.totalTeams || '?'} teams</li>
                  <li>Format: ${result.isDynasty ? 'Dynasty' : 'Redraft'}</li>
                  <li>Scoring: ${(result.scoring || result.scoringType || 'STD').toUpperCase()}</li>
                </ul>
                <p>Your AI tools (Waiver AI, Trade Analyzer, Roster Report) will now use the latest data.</p>
                <p style="color: #64748b; font-size: 0.85em; margin-top: 24px;">
                  Sync ID: ${result.leagueId || result.id || 'N/A'}<br>
                  If this wasn't you, contact support.
                </p>
              </div>
            `,
          });
        }
      } catch (emailErr) {
        console.error('[League Sync] Email notification failed:', emailErr);
      }
    }

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

    if (process.env.NODE_ENV === 'production' && userEmail && normalizedPlatform) {
      try {
        const { client, fromEmail } = await getResendClient();
        await client.emails.send({
          from: fromEmail || 'AllFantasy.ai <noreply@allfantasy.ai>',
          to: userEmail,
          subject: `League Sync Failed: ${normalizedPlatform.toUpperCase()}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 16px;">
              <h2 style="background: linear-gradient(90deg, #22d3ee, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center;">AllFantasy.ai</h2>
              <h3 style="color: #ef4444;">League Sync Failed</h3>
              <p>We tried to sync your ${normalizedPlatform.toUpperCase()} league but ran into an issue:</p>
              <p style="color: #ef4444; background: rgba(239,68,68,0.1); padding: 12px; border-radius: 8px;">${error.message || 'Unknown error'}</p>
              <p>Please check your league ID and credentials, then try again from the dashboard.</p>
              <p style="color: #64748b; font-size: 0.85em; margin-top: 24px;">If this keeps happening, contact support.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('[League Sync] Failure email notification failed:', emailErr);
      }
    }

    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
