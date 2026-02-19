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

  const [messages, receipts] = await Promise.all([
    prisma.madnessChatMessage.findMany({
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
    }),
    prisma.chatReadReceipt.findMany({
      where: { leagueId },
      include: {
        user: {
          select: { id: true, username: true, displayName: true },
        },
      },
    }),
  ]);

  const sorted = messages.reverse();

  const receiptEntries = receipts
    .filter(r => r.userId !== session.user!.id)
    .map(r => ({
      userId: r.userId,
      username: r.user.displayName || r.user.username,
      lastSeenAt: r.lastSeenAt,
    }));

  const enriched = sorted.map(msg => {
    const seenBy: string[] = [];
    for (const receipt of receiptEntries) {
      if (receipt.lastSeenAt >= msg.createdAt) {
        seenBy.push(receipt.username);
      }
    }
    return { ...msg, seenBy };
  });

  return NextResponse.json({
    messages: enriched,
    nextCursor: messages.length === limit ? messages[messages.length - 1]?.id : null,
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
