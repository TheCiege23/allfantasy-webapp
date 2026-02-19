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

  const { messageId } = await req.json();

  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
  }

  const message = await prisma.madnessChatMessage.findUnique({
    where: { id: messageId },
    include: { league: { select: { ownerId: true } } },
  });

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  if (message.league.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Only the league owner can pin messages' }, { status: 403 });
  }

  if (!message.isPinned) {
    await prisma.madnessChatMessage.updateMany({
      where: { leagueId: message.leagueId, isPinned: true },
      data: { isPinned: false },
    });
  }

  const updated = await prisma.madnessChatMessage.update({
    where: { id: messageId },
    data: { isPinned: !message.isPinned },
  });

  return NextResponse.json({ isPinned: updated.isPinned });
}
