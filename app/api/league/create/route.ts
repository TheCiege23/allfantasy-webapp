import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['sleeper', 'espn', 'manual']),
  platformLeagueId: z.string().optional(),
  leagueSize: z.number().min(4).max(32),
  scoring: z.string(),
  isDynasty: z.boolean(),
  isSuperflex: z.boolean().optional(),
  userId: z.string(),
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
  }

  const { name, platform, platformLeagueId, leagueSize, scoring, isDynasty, isSuperflex } = parsed.data;

  try {
    if (platformLeagueId && platform !== 'manual') {
      const existing = await (prisma as any).league.findFirst({
        where: {
          userId: session.user.id,
          platform,
          platformLeagueId,
        },
      });

      if (existing) {
        return NextResponse.json({ error: 'This league already exists in your account' }, { status: 409 });
      }
    }

    const league = await (prisma as any).league.create({
      data: {
        userId: session.user.id,
        name,
        platform,
        platformLeagueId: platformLeagueId || `manual-${Date.now()}`,
        leagueSize,
        scoring,
        isDynasty,
        settings: isSuperflex ? { superflex: true } : {},
        syncStatus: platform === 'manual' ? 'manual' : 'pending',
      },
    });

    return NextResponse.json({ league: { id: league.id, name: league.name } });
  } catch (err) {
    console.error('[league/create] Error:', err);
    return NextResponse.json({ error: 'Failed to create league' }, { status: 500 });
  }
}
