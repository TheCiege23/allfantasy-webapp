import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_REASONS = ['spam', 'harassment', 'profanity', 'inappropriate', 'other'];

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messageId, reason } = await req.json();

  if (!messageId || !reason) {
    return NextResponse.json({ error: 'messageId and reason are required' }, { status: 400 });
  }

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
  }

  const message = await prisma.madnessChatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  if (message.userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot flag your own message' }, { status: 400 });
  }

  const existing = await prisma.chatMessageFlag.findFirst({
    where: { messageId, reportedById: session.user.id },
  });

  if (existing) {
    return NextResponse.json({ error: 'Already flagged' }, { status: 409 });
  }

  const flag = await prisma.chatMessageFlag.create({
    data: {
      messageId,
      reportedById: session.user.id,
      reason,
    },
  });

  return NextResponse.json({ success: true, flagId: flag.id });
}
