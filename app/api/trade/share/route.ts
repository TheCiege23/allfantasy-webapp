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
  teamAName: z.string().max(100).default('Team A'),
  teamBName: z.string().max(100).default('Team B'),
  teamAAssets: z.array(assetSchema).max(20),
  teamBAssets: z.array(assetSchema).max(20),
  leagueContext: z.string().max(500).default('12-team SF PPR dynasty'),
  analysis: z.object({
    winner: z.string(),
    valueDelta: z.string(),
    factors: z.array(z.string()),
    confidence: z.number(),
    dynastyVerdict: z.string().optional(),
    vetoRisk: z.string().optional(),
    agingConcerns: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
  }),
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

  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid trade data' }, { status: 400 });
  }

  try {
    const share = await (prisma as any).tradeShare.create({
      data: {
        userId: session.user.id,
        teamAName: parsed.data.teamAName,
        teamBName: parsed.data.teamBName,
        teamAAssets: parsed.data.teamAAssets,
        teamBAssets: parsed.data.teamBAssets,
        leagueContext: parsed.data.leagueContext,
        analysis: parsed.data.analysis,
      },
    });

    return NextResponse.json({ shareId: share.id });
  } catch (err) {
    console.error('[trade/share] Error:', err);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}
