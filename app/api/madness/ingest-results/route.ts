import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrBearer } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

const ROUND_POINTS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
  6: 32,
};

webpush.setVapidDetails(
  'mailto:support@allfantasy.ai',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
);

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrBearer(req);
  if (!auth.ok) return auth.res;

  const body = await req.json();
  const { gameId, winner } = body;

  if (!gameId || !winner) {
    return NextResponse.json({ error: 'gameId and winner are required' }, { status: 400 });
  }

  const game = await prisma.marchMadnessGame.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  await prisma.marchMadnessGame.update({
    where: { id: gameId },
    data: { winnerId: winner },
  });

  await prisma.marchMadnessResult.upsert({
    where: { id: gameId },
    update: { winner, round: game.round },
    create: { gameId, winner, round: game.round },
  });

  const picks = await prisma.marchMadnessPick.findMany({
    where: { gameId },
    include: {
      bracket: {
        include: {
          user: {
            include: { pushSubscriptions: true },
          },
        },
      },
    },
  });

  const points = ROUND_POINTS[game.round] || 1;
  let notified = 0;

  for (const pick of picks) {
    const isCorrect = pick.winnerTeam === winner;

    await prisma.marchMadnessPick.update({
      where: { id: pick.id },
      data: {
        isCorrect,
        points: isCorrect ? points : 0,
      },
    });

    const user = pick.bracket.user;
    if (!user.pushSubscriptions.length) continue;

    const pickResult = isCorrect ? '✅ Correct!' : '❌ Wrong';
    const payload = JSON.stringify({
      title: 'Game Result!',
      body: `${game.team1} vs ${game.team2} finished. Your pick: ${pickResult}`,
    });

    for (const sub of user.pushSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        notified++;
      } catch {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  }

  return NextResponse.json({
    success: true,
    gameId,
    winner,
    round: game.round,
    picksScored: picks.length,
    notificationsSent: notified,
  });
}
