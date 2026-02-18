import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as any)?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { platform, credentials } = await req.json().catch(() => ({}));

  if (!platform) {
    return NextResponse.json({ error: 'Missing platform' }, { status: 400 });
  }

  try {
    let discovered: any[] = [];

    switch (platform.toLowerCase()) {
      case 'sleeper':
        if (!credentials?.username) throw new Error('Sleeper username required');
        const res = await fetch(`https://api.sleeper.app/v1/user/${credentials.username}/leagues/nfl/2025`);
        if (!res.ok) throw new Error('Failed to discover Sleeper leagues');
        discovered = await res.json();
        break;

      case 'mfl':
        if (!credentials?.apiKey) throw new Error('MFL API key required');
        discovered = [{ leagueId: 'placeholder', name: 'MFL League (manual add)' }];
        break;

      case 'yahoo':
        if (!credentials?.oauthToken) throw new Error('Yahoo OAuth required');
        discovered = [{ leagueId: 'yahoo-placeholder', name: 'Yahoo League (OAuth pending)' }];
        break;

      case 'espn':
        if (!credentials?.espnSwid || !credentials?.espnS2) throw new Error('ESPN cookies required');
        discovered = [{ leagueId: 'espn-placeholder', name: 'ESPN League (cookie-based)' }];
        break;

      case 'fantrax':
        discovered = [{ leagueId: 'fantrax-placeholder', name: 'Fantrax League (manual)' }];
        break;

      default:
        throw new Error('Unsupported platform');
    }

    return NextResponse.json({ success: true, discovered });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Discovery failed' }, { status: 500 });
  }
}
