import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import TradeHistoryFeed from '@/components/TradeHistoryFeed';

export default async function TradeHistoryPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) redirect('/login');

  const trades = await (prisma as any).tradeShare.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Trade History
        </h1>
        <TradeHistoryFeed trades={trades} />
      </div>
    </div>
  );
}
