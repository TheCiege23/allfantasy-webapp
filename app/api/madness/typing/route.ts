import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const typingState = new Map<string, { userId: string; username: string; timestamp: number }[]>();

const TYPING_TTL = 4000;

function cleanExpired(leagueId: string) {
  const now = Date.now();
  const current = typingState.get(leagueId) || [];
  const valid = current.filter(t => now - t.timestamp < TYPING_TTL);
  typingState.set(leagueId, valid);
  return valid;
}

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leagueId = req.nextUrl.searchParams.get('leagueId');
  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
  }

  const typers = cleanExpired(leagueId).filter(t => t.userId !== session.user!.id);

  return NextResponse.json({
    typing: typers.map(t => t.username),
  });
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; name?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { leagueId } = await req.json();
  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
  }

  const current = typingState.get(leagueId) || [];
  const existing = current.find(t => t.userId === session.user!.id);

  if (existing) {
    existing.timestamp = Date.now();
  } else {
    current.push({
      userId: session.user.id,
      username: session.user.name || 'Someone',
      timestamp: Date.now(),
    });
  }

  typingState.set(leagueId, current);

  return NextResponse.json({ ok: true });
}
