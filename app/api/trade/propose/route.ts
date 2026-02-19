import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const proposeSchema = z.object({
  leagueId: z.string(),
  offerFrom: z.number(),
  offerTo: z.number(),
  drops: z.array(z.string()).default([]),
  adds: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = proposeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid proposal data', details: parsed.error.errors }, { status: 400 });
  }

  const { leagueId, offerFrom, offerTo, drops, adds } = parsed.data;

  try {
    const share = await (prisma as any).tradeShare.create({
      data: {
        userId: session.user.id,
        sideA: { rosterId: offerFrom, assets: adds },
        sideB: { rosterId: offerTo, assets: drops },
        analysis: {
          type: 'proposal',
          status: 'pending',
          leagueId,
          createdBy: session.user.id,
        },
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    return NextResponse.json({
      success: true,
      shareId: share.id,
      message: 'Trade proposal saved. Open Sleeper to send this trade to the other manager.',
      sleeperDeepLink: `https://sleeper.com/leagues/${leagueId}`,
    });
  } catch (err) {
    console.error('[trade/propose] Error:', err);
    return NextResponse.json({ error: 'Failed to save trade proposal' }, { status: 500 });
  }
}
