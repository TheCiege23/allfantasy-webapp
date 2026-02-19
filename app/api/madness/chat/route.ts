import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

  const cursor = req.nextUrl.searchParams.get('cursor');
  const limit = 50;

  const messages = await prisma.madnessChatMessage.findMany({
    where: { leagueId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      reactions: {
        select: { emoji: true, userId: true },
      },
    },
  });

  return NextResponse.json({
    messages: messages.reverse(),
    nextCursor: messages.length === limit ? messages[0]?.id : null,
  });
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { leagueId, message } = await req.json();

  if (!leagueId || !message?.trim()) {
    return NextResponse.json({ error: 'leagueId and message are required' }, { status: 400 });
  }

  if (message.length > 1000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 });
  }

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: session.user.id } },
  });

  if (!member) {
    return NextResponse.json({ error: 'Not a league member' }, { status: 403 });
  }

  const chatMessage = await prisma.madnessChatMessage.create({
    data: {
      leagueId,
      userId: session.user.id,
      message: message.trim(),
    },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json(chatMessage);
}
