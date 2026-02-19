import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const assetSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  type: z.enum(['player', 'pick']),
});

const shareSchema = z.object({
  sideA: z.array(assetSchema).max(20),
  sideB: z.array(assetSchema).max(20),
  analysis: z.object({
    winner: z.string(),
    valueDelta: z.string(),
    factors: z.array(z.string()),
    confidence: z.number(),
    dynastyVerdict: z.string().optional(),
    vetoRisk: z.string().optional(),
    agingConcerns: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
    teamAName: z.string().optional(),
    teamBName: z.string().optional(),
    leagueContext: z.string().optional(),
  }),
});

const SHARE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

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

  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid trade data' }, { status: 400 });
  }

  try {
    const share = await (prisma as any).tradeShare.create({
      data: {
        sideA: parsed.data.sideA,
        sideB: parsed.data.sideB,
        analysis: parsed.data.analysis,
        expiresAt: new Date(Date.now() + SHARE_TTL_MS),
      },
    });

    return NextResponse.json({ shareId: share.id });
  } catch (err) {
    console.error('[trade/share] Error:', err);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}
