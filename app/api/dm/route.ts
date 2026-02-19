import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function shareLeague(userA: string, userB: string): Promise<boolean> {
  const shared = await prisma.bracketLeagueMember.findFirst({
    where: {
      userId: userA,
      league: {
        members: {
          some: { userId: userB },
        },
      },
    },
  });
  return !!shared;
}

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const partnerId = req.nextUrl.searchParams.get('partnerId');

  if (partnerId) {
    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = 50;

    const messages = await prisma.privateChatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  }

  const conversations = await prisma.$queryRaw`
    WITH latest_messages AS (
      SELECT DISTINCT ON (partner_id) 
        m.*,
        CASE 
          WHEN m."senderId" = ${userId} THEN m."receiverId"
          ELSE m."senderId"
        END AS partner_id
      FROM private_chat_messages m
      WHERE m."senderId" = ${userId} OR m."receiverId" = ${userId}
      ORDER BY partner_id, m."createdAt" DESC
    )
    SELECT 
      lm.id,
      lm.message,
      lm."createdAt",
      lm."senderId",
      lm.partner_id as "partnerId",
      u.username as "partnerUsername",
      u."displayName" as "partnerDisplayName",
      u."avatarUrl" as "partnerAvatarUrl",
      (
        SELECT COUNT(*)::int 
        FROM private_chat_messages 
        WHERE "senderId" = lm.partner_id 
          AND "receiverId" = ${userId} 
          AND "isRead" = false
      ) as "unreadCount"
    FROM latest_messages lm
    JOIN app_users u ON u.id = lm.partner_id
    ORDER BY lm."createdAt" DESC
  `;

  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { receiverId, message } = await req.json();

  if (!receiverId || !message?.trim()) {
    return NextResponse.json({ error: 'receiverId and message are required' }, { status: 400 });
  }

  if (message.trim().length > 1000) {
    return NextResponse.json({ error: 'Message too long (max 1000 chars)' }, { status: 400 });
  }

  if (receiverId === session.user.id) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
  }

  const receiver = await prisma.appUser.findUnique({ where: { id: receiverId } });
  if (!receiver) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const inSameLeague = await shareLeague(session.user.id, receiverId);
  if (!inSameLeague) {
    return NextResponse.json({ error: 'You can only message members of your leagues' }, { status: 403 });
  }

  const dm = await prisma.privateChatMessage.create({
    data: {
      senderId: session.user.id,
      receiverId,
      message: message.trim(),
    },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ message: dm });
}
