import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/league-auth-crypto';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID;
  const YAHOO_CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET;
  if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET) {
    console.error('[Yahoo Callback] Missing YAHOO_CLIENT_ID or YAHOO_CLIENT_SECRET');
    return NextResponse.redirect(new URL('/leagues?error=yahoo_not_configured', req.url));
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    console.error('[Yahoo Callback] OAuth error:', error);
    return NextResponse.redirect(new URL(`/leagues?error=yahoo_denied`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/leagues?error=no_code', req.url));
  }

  const storedState = req.cookies.get('yahoo_league_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    console.error('[Yahoo Callback] State mismatch');
    return NextResponse.redirect(new URL('/leagues?error=invalid_state', req.url));
  }

  const redirectUri = process.env.YAHOO_REDIRECT_URI || `${req.nextUrl.origin}/api/league/yahoo/callback`;

  try {
    const tokenRes = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${YAHOO_CLIENT_ID}:${YAHOO_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('[Yahoo Callback] Token error:', tokenData);
      return NextResponse.redirect(new URL('/leagues?error=token_failed', req.url));
    }

    const { access_token, refresh_token } = tokenData;

    await (prisma as any).leagueAuth.upsert({
      where: { userId_platform: { userId, platform: 'yahoo' } },
      update: {
        oauthToken: encrypt(access_token),
        oauthSecret: refresh_token ? encrypt(refresh_token) : undefined,
        updatedAt: new Date(),
      },
      create: {
        userId,
        platform: 'yahoo',
        oauthToken: encrypt(access_token),
        oauthSecret: refresh_token ? encrypt(refresh_token) : null,
      },
    });

    const response = NextResponse.redirect(new URL('/leagues?success=yahoo_connected', req.url));
    response.cookies.delete('yahoo_league_oauth_state');
    return response;
  } catch (err: any) {
    console.error('[Yahoo Callback] Error:', err);
    return NextResponse.redirect(new URL('/leagues?error=auth_failed', req.url));
  }
}
