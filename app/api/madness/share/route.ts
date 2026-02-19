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

  const { bracketId } = await req.json();

  if (!bracketId) {
    return NextResponse.json({ error: 'bracketId is required' }, { status: 400 });
  }

  const bracket = await prisma.bracketEntry.findUnique({
    where: { id: bracketId },
  });

  if (!bracket || bracket.userId !== session.user.id) {
    return NextResponse.json({ error: 'Bracket not found' }, { status: 404 });
  }

  const existing = await prisma.marchMadnessShare.findFirst({
    where: { bracketId },
  });

  if (existing) {
    return NextResponse.json({ shareId: existing.id });
  }

  const share = await prisma.marchMadnessShare.create({
    data: { bracketId },
  });

  return NextResponse.json({ shareId: share.id });
}
