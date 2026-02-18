import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await (prisma as any).appUser.findUnique({
    where: { id: userId },
    select: { activeLeagueId: true },
  });

  return NextResponse.json({ activeLeagueId: user?.activeLeagueId || null });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { activeLeagueId } = body;

  if (!activeLeagueId) {
    return NextResponse.json({ error: 'Missing activeLeagueId' }, { status: 400 });
  }

  await (prisma as any).appUser.update({
    where: { id: userId },
    data: { activeLeagueId },
  });

  return NextResponse.json({ success: true, activeLeagueId });
}
