import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { leagueId, messageId } = await req.json();

  if (!leagueId || !messageId) {
    return NextResponse.json({ error: 'leagueId and messageId are required' }, { status: 400 });
  }

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  });

  if (!member) {
    return NextResponse.json({ error: 'Not a league member' }, { status: 403 });
  }

  const msg = await prisma.madnessChatMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg || msg.leagueId !== leagueId) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  await prisma.chatReadReceipt.upsert({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
    create: {
      leagueId,
      userId: session.user.id,
      lastSeenMsgId: messageId,
      lastSeenAt: msg.createdAt,
    },
    update: {
      lastSeenMsgId: messageId,
      lastSeenAt: msg.createdAt,
    },
  });

  return NextResponse.json({ ok: true });
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
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
  }

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  });

  if (!member) {
    return NextResponse.json({ error: 'Not a league member' }, { status: 403 });
  }

  const receipts = await prisma.chatReadReceipt.findMany({
    where: { leagueId },
    include: {
      user: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });

  return NextResponse.json({ receipts });
}
