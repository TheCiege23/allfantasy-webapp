import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as any)?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session!.user as any).id as string;
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');

  if (!leagueId) return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });

  const roster = await (prisma as any).roster.findFirst({
    where: { leagueId, userId },
  });

  if (!roster) return NextResponse.json({ error: 'Roster not found' }, { status: 404 });

  return NextResponse.json({
    roster: roster.playerData,
    faabRemaining: roster.faabRemaining,
  });
}
