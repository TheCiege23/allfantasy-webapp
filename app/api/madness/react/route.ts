import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_EMOJIS = [
  '👍', '❤️', '😂', '🔥', '😭', '🤯', '🙌', '💯',
  '👀', '🤔', '😤', '🎉', '💪', '🤩', '😱', '🤬',
  '🥳', '😎', '🤝', '👑',
];

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messageId, emoji } = await req.json();

  if (!messageId || !emoji) {
    return NextResponse.json({ error: 'messageId and emoji are required' }, { status: 400 });
  }

  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 });
  }

  const existing = await prisma.madnessChatReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId: session.user.id,
        emoji,
      },
    },
  });

  if (existing) {
    await prisma.madnessChatReaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ action: 'removed' });
  }

  await prisma.madnessChatReaction.create({
    data: {
      messageId,
      userId: session.user.id,
      emoji,
    },
  });

  return NextResponse.json({ action: 'added' });
}
