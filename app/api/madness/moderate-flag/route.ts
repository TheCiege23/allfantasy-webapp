import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { flagId, status, adminNotes } = await req.json();

  if (!flagId || !status) {
    return NextResponse.json({ error: 'flagId and status are required' }, { status: 400 });
  }

  if (!['dismissed', 'resolved', 'deleted'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const flag = await prisma.chatMessageFlag.findUnique({
    where: { id: flagId },
  });

  if (!flag) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
  }

  if (status === 'deleted') {
    await prisma.madnessChatMessage.delete({
      where: { id: flag.messageId },
    });

    return NextResponse.json({ success: true, action: 'message_deleted' });
  }

  await prisma.chatMessageFlag.update({
    where: { id: flagId },
    data: {
      status,
      adminNotes: adminNotes || null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, status });
}
