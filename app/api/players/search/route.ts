import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const querySchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().default(10),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const { q, limit } = parsed.data;

  const players = await (prisma as any).sportsPlayer.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { position: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, position: true, team: true },
    take: limit,
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(players);
}
